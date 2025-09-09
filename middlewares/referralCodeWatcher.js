// Run this file as a separate worker process. Must be connected to a replica set for change streams.
const mongoose = require('mongoose');
const User = require('../models/userModels/userModel');
const ReferralEdge = require('../models/userModels/userRefferalModels/refferalEdgeModle');
const DirectFinisher = require('../models/userModels/userRefferalModels/refferalEdgeModle');

async function startWatcher() {
  const db = mongoose.connection;
  const changeStream = User.watch([
    {
      $match: {
        operationType: 'update',
        'updateDescription.updatedFields.referralCodeValid': { $exists: true }
      }
    }
  ], { fullDocument: 'updateLookup' });

  changeStream.on('change', async (change) => {
    try {
      const userId = change.documentKey._id;
      const newValid = change.updateDescription.updatedFields.referralCodeValid;
      // find the parent edge (child->parent)
      const edge = await ReferralEdge.findOne({ childId: userId }).sort({ createdAt: 1 });
      if (!edge) return;

      // update DirectFinisher row for parent->child
      await DirectFinisher.updateOne(
        { parentId: edge.parentId, childId: userId },
        {
          $set: {
            status: newValid ? 'incomplete' : 'finished',
            side: edge.side,
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );

      // If flipping to finished, you may want to emit events (payouts etc.) here.
    } catch (err) {
      console.error('ChangeStream processing error:', err);
      // consider a retry / dead-letter mechanism
    }
  });

  changeStream.on('error', (err) => {
    console.error('ChangeStream error:', err);
    // process should restart watcher with backoff, or you can exit to be restarted by PM2/docker
  });

  console.log('Referral code watcher started.');
}

module.exports = { startWatcher };
