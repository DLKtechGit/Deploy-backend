const mongoose = require('mongoose');
const User = require('../models/userModels/userModel');
const ReferralEdge = require('../models/userModels/userRefferalModels/refferalEdgeModle');
const UserLevel = require('../models/userModels/userRefferalModels/userReferralLevelModel');
const DirectFinisher = require('../models/userModels/userRefferalModels/directReferralFinishers');
const { computeThreshold } = require('../middlewares/threshHold');

// get or create level document (upsert)
async function getOrCreateLevel(userId, level, session = null) {
  const threshold = computeThreshold(level);
  await UserLevel.updateOne(
    { userId, level },
    {
      $setOnInsert: {
        userId,
        level,
        tier: Math.ceil(level / 10),
        leftTreeCount: 0,
        rightTreeCount: 0,
        threshold
      }
    },
    { upsert: true, session }
  );
  return UserLevel.findOne({ userId, level }).session(session);
}

// decide placement level policy: simplest — highest incomplete level (lowest level with space)
// You can have more sophisticated logic.
async function getActivePlacementLevel(userId, session = null) {
  // find highest level doc
  const lvl = await UserLevel.find({ userId }).sort({ level: -1 }).limit(1).session(session);
  if (lvl && lvl.length) {
    return lvl[0].level;
  }
  return 1;
}

/**
 * Place a referral under a parent (idempotent)
 * - creates ReferralEdge if not exists
 * - increments parent UserLevel's side count
 * - creates DirectFinisher as 'incomplete' for parent->child
 */
async function placeReferral({ parentId, childId }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // ensure level exists
    let level = await getActivePlacementLevel(parentId, session);
    // ensure level doc exists
    let lvlDoc = await getOrCreateLevel(parentId, level, session);

    // choose side
    const side = (lvlDoc.leftTreeCount <= lvlDoc.rightTreeCount) ? 'left' : 'right';

    // idempotent edge creation
    await ReferralEdge.updateOne(
      { parentId, childId },
      {
        $setOnInsert: {
          parentId, childId, level, side, createdAt: new Date()
        }
      },
      { upsert: true, session }
    );

    // increment counts on the level
    await UserLevel.updateOne(
      { userId: parentId, level },
      { $inc: side === 'left' ? { leftTreeCount: 1 } : { rightTreeCount: 1 } },
      { session }
    );

    // increment small counter on User (directReferralsCount)
    await User.updateOne({ _id: parentId }, { $inc: { directReferralsCount: 1 } }, { session });

    // seed direct finisher record
    await DirectFinisher.updateOne(
      { parentId, childId },
      {
        $setOnInsert: {
          parentId,
          childId,
          side,
          status: 'incomplete',
          createdAt: new Date()
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, session }
    );

    // Try promotion for this parent (enqueue in production; here syncronous)
    await tryPromoteUserLevel(parentId, level, session);

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Try to promote user at level L to L+1, with carry-over of overflow
 * Must be called inside a transaction if part of larger flow.
 */
async function tryPromoteUserLevel(userId, level, externalSession = null) {
  const session = externalSession || (await mongoose.startSession());
  let createdLocalSession = false;
  try {
    if (!externalSession) { session.startTransaction(); createdLocalSession = true; }

    const lvl = await UserLevel.findOne({ userId, level }).session(session);
    if (!lvl) {
      if (createdLocalSession) {
        await session.commitTransaction();
        session.endSession();
      }
      return; // nothing to do
    }

    if (lvl.leftTreeCount >= lvl.threshold && lvl.rightTreeCount >= lvl.threshold) {
      // ensure target level doc exists
      const nextLevel = level + 1;
      await getOrCreateLevel(userId, nextLevel, session);

      // carry-over left overflow
      const leftOverflow = lvl.leftTreeCount - lvl.threshold;
      if (leftOverflow > 0) {
        // get last leftOverflow edges (latest ones)
        const toMoveLeft = await ReferralEdge.find({ parentId: userId, level, side: 'left' })
          .sort({ createdAt: -1 })
          .limit(leftOverflow)
          .session(session);

        const ids = toMoveLeft.map(e => e._id);
        if (ids.length) {
          await ReferralEdge.updateMany({ _id: { $in: ids } }, { $set: { level: nextLevel } }, { session });
          await UserLevel.updateOne({ userId, level }, { $inc: { leftTreeCount: -ids.length } }, { session });
          await UserLevel.updateOne({ userId, level: nextLevel }, { $inc: { leftTreeCount: ids.length } }, { session });
        }
      }

      // carry-over right overflow (if you want symmetrical behavior)
      const rightOverflow = lvl.rightTreeCount - lvl.threshold;
      if (rightOverflow > 0) {
        const toMoveRight = await ReferralEdge.find({ parentId: userId, level, side: 'right' })
          .sort({ createdAt: -1 })
          .limit(rightOverflow)
          .session(session);

        const ids = toMoveRight.map(e => e._id);
        if (ids.length) {
          await ReferralEdge.updateMany({ _id: { $in: ids } }, { $set: { level: nextLevel } }, { session });
          await UserLevel.updateOne({ userId, level }, { $inc: { rightTreeCount: -ids.length } }, { session });
          await UserLevel.updateOne({ userId, level: nextLevel }, { $inc: { rightTreeCount: ids.length } }, { session });
        }
      }

      // NOTE: we do NOT delete the L1 doc — it stays. We only move overflow edges to level+1.
      // If you have side-effects on promotion (e.g., set flags, payout) handle it here.

      // Optionally enqueue a job that tries to promote for the ancestor user who referred this user (chain promotions).
    }

    if (createdLocalSession) {
      await session.commitTransaction();
      session.endSession();
    }
  } catch (err) {
    if (createdLocalSession) {
      await session.abortTransaction();
      session.endSession();
    }
    throw err;
  }
}

module.exports = {
  placeReferral,
  tryPromoteUserLevel,
  getOrCreateLevel
};
