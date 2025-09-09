const Feed = require('../../models/feedModel');
const User = require('../../models/userModels/userModel');
const Creator = require('../../models/creatorModel');
const { feedTimeCalculator } = require('../../middlewares/feedTimeCalculator');
const UserFeedActions =require('../../models/userFeedInterSectionModel.js');
const fs = require('fs');
const path=require('path');
const Account =require("../../models/accountSchemaModel.js")
const Admin=require("../../models/adminModels/adminModel.js")
const mongoose = require("mongoose");
const UserComment = require("../../models/userModels/userCommentModel.js");
const UserView = require("../../models/userModels/userViewFeedsModel.js");
const CommentLike = require("../../models/userModels/commentsLikeModel.js");
const UserLanguage=require('../../models/userModels/userLanguageModel.js');
const  UserCategory=require('../../models/userModels/userCategotyModel.js');
const ProfileSettings=require('../../models/profileSettingModel.js')



exports.getAllFeedsByUserId = async (req, res) => {
  try {
    const rawUserId = req.Id || req.body.userId;
    const userId = rawUserId ? new mongoose.Types.ObjectId(rawUserId) : null;
    console.log(rawUserId)
 
    if (!rawUserId) {
      return res.status(404).json({ message: "User ID Required " });
    }
 
    const host = `${req.protocol}://${req.get("host")}`;
 
    // 1️⃣ Get all feeds
    const feeds = await Feed.find().sort({ createdAt: -1 }).lean();
    if (!feeds.length) return res.status(404).json({ message: "No feeds found" });
 
    const feedIds = feeds.map(f => f._id);
    const accountIds = feeds.map(f => f.createdByAccount);
 
    // 2️⃣ Aggregate global likes/downloads/shares
    const actions = await UserFeedActions.aggregate([
      { $project: { likedFeeds: 1, downloadedFeeds: 1, sharedFeeds: 1 } },
      {
        $facet: {
          likes: [
            { $unwind: { path: "$likedFeeds", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$likedFeeds", count: { $sum: 1 } } }
          ],
          downloads: [
            { $unwind: { path: "$downloadedFeeds", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$downloadedFeeds", count: { $sum: 1 } } }
          ],
          shares: [
            { $unwind: { path: "$sharedFeeds", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$sharedFeeds.feedId", count: { $sum: 1 } } }
          ]
        }
      }
    ]);
 
    const likesCountMap = {};
    const downloadsCountMap = {};
    const sharesCountMap = {};
    if (actions[0]) {
      (actions[0].likes || []).forEach(item => {
        if (item._id) likesCountMap[item._id.toString()] = item.count;
      });
      (actions[0].downloads || []).forEach(item => {
        if (item._id) downloadsCountMap[item._id.toString()] = item.count;
      });
      (actions[0].shares || []).forEach(item => {
        if (item._id) sharesCountMap[item._id.toString()] = item.count;
      });
    }
 
    // 3️⃣ Get current user actions
    let userActions = { likedFeeds: [], savedFeeds: [] };
    if (userId) {
      const uaDoc = await UserFeedActions.findOne({ userId }).lean();
      if (uaDoc) {
        userActions.likedFeeds = (uaDoc.likedFeeds || []).map(f => f.toString());
        userActions.savedFeeds = (uaDoc.savedFeeds || []).map(f => f.toString());
      }
    }
 
    // 4️⃣ Views count
    const viewsAgg = await UserView.aggregate([
      { $match: { feedId: { $in: feedIds } } },
      { $group: { _id: "$feedId", count: { $sum: 1 } } }
    ]);
    const viewsMap = {};
    viewsAgg.forEach(v => { viewsMap[v._id.toString()] = v.count });
 
    // 5️⃣ Comment count
    const commentsAgg = await UserComment.aggregate([
      { $match: { feedId: { $in: feedIds } } },
      { $group: { _id: "$feedId", count: { $sum: 1 } } }
    ]);
    const commentsMap = {};
    commentsAgg.forEach(c => { commentsMap[c._id.toString()] = c.count });
 
    // 6️⃣ Get Accounts → Profile Settings
    const accounts = await Account.find(
      { _id: { $in: accountIds } },
      { _id: 1, userId: 1 }
    ).lean();
 
    const userIds = accounts.map(a => a.userId);
 
    const profiles = await ProfileSettings.find(
      { userId: { $in: userIds } },
      { userName: 1, profileAvatar: 1, userId: 1 }
    ).lean();
 
    const accountToUserIdMap = {};
    accounts.forEach(acc => { accountToUserIdMap[acc._id.toString()] = acc.userId.toString(); });
 
    const userIdToProfileMap = {};
    profiles.forEach(p => { userIdToProfileMap[p.userId.toString()] = p; });
 
    // 7️⃣ Build final response (✅ FLATTENED userName & profileAvatar)
    const enrichedFeeds = feeds.map(feed => {
      const fid = feed._id.toString();
      const folder = feed.type === "video" ? "videos" : "images";
      const contentUrlFull = feed.contentUrl
        ? `${host}/uploads/${folder}/${path.basename(feed.contentUrl)}`
        : null;
 
      const creatorUserId = accountToUserIdMap[feed.createdByAccount?.toString()] || null;
      const profile = creatorUserId ? userIdToProfileMap[creatorUserId] : null;
 
      return {
        feedId: fid,
        type: feed.type,
        language: feed.language,
        category: feed.category,
        contentUrl: contentUrlFull,
        timeAgo: feedTimeCalculator(feed.createdAt),
        likesCount: likesCountMap[fid] || 0,
        shareCount: sharesCountMap[fid] || 0,
        downloadsCount: downloadsCountMap[fid] || 0,
        viewsCount: viewsMap[fid] || 0,
        commentsCount: commentsMap[fid] || 0,
        isLiked: userActions.likedFeeds.includes(fid),
        isSaved: userActions.savedFeeds.includes(fid),
        userName: profile ? profile.userName || "Unknown" : "Unknown",
        profileAvatar: profile?.profileAvatar
          ? `${host}/uploads/images/${path.basename(profile.profileAvatar)}`
          : null
      };
    });
 
    res.status(200).json({
      message: "Feeds retrieved successfully",
      feeds: enrichedFeeds
    });
 
  } catch (error) {
    console.error("Error in getAllFeeds:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
 


exports.getFeedsByAccountId = async (req, res) => {
  try {
    const accountId = req.accountId || req.body.accountId;
    if (!accountId) return res.status(400).json({ message: "accountId required" });

    // 1️⃣ Find corresponding userId from Account
    const account = await Account.findById(accountId).lean();
    if (!account) return res.status(404).json({ message: "Account not found" });
    const userId = account.userId;

    const host = `${req.protocol}://${req.get("host")}`;

    // 2️⃣ Get user's feed language preference
    const userLang = await UserLanguage.findOne({ userId }).lean();
    const feedLangCode = userLang?.feedLanguageCode || null;

    // 3️⃣ Get user's category preferences
    const userCat = await UserCategory.findOne({ userId }).lean();
    const excludedCategories = (userCat?.nonInterestedCategories || []).map(c => c.toString());

    // 4️⃣ Filter feeds based on language and category
    const feedFilter = {};
    if (feedLangCode) feedFilter.language = feedLangCode;
    if (excludedCategories.length) feedFilter.category = { $nin: excludedCategories };

    const feeds = await Feed.find(feedFilter).sort({ createdAt: -1 }).lean();
    if (!feeds.length) return res.status(404).json({ message: "No feeds found" });

    const feedIds = feeds.map(f => f._id);

    // 5️⃣ Aggregate total likes, shares, downloads
    const actionsAgg = await UserFeedActions.aggregate([
      { $match: { $or: [{ accountId: { $exists: true } }] } },
      { $project: { likedFeeds: 1, downloadedFeeds: 1, sharedFeeds: 1 } },
      { $unwind: { path: "$likedFeeds", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$downloadedFeeds", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$sharedFeeds", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          likesMap: { $push: "$likedFeeds" },
          downloadsMap: { $push: "$downloadedFeeds" },
          sharesMap: { $push: "$sharedFeeds.feedId" }
        }
      }
    ]);

    const data = actionsAgg[0] || {};
    const likesCount = {};
    const downloadsCount = {};
    const sharesCount = {};
    (data.likesMap || []).forEach(f => { if (f) likesCount[f.toString()] = (likesCount[f.toString()] || 0) + 1 });
    (data.downloadsMap || []).forEach(f => { if (f) downloadsCount[f.toString()] = (downloadsCount[f.toString()] || 0) + 1 });
    (data.sharesMap || []).forEach(f => { if (f) sharesCount[f.toString()] = (sharesCount[f.toString()] || 0) + 1 });

    // 6️⃣ Get current account actions
    const userActionsDoc = await UserFeedActions.findOne({ accountId }).lean();
    const likedFeedIds = (userActionsDoc?.likedFeeds || []).map(f => f.toString());
    const savedFeedIds = (userActionsDoc?.savedFeeds || []).map(f => f.toString());

    // 7️⃣ Get views count
    const viewsAgg = await UserView.aggregate([
      { $match: { feedId: { $in: feedIds } } },
      { $group: { _id: "$feedId", count: { $sum: 1 } } }
    ]);
    const viewsCount = {};
    viewsAgg.forEach(v => { viewsCount[v._id.toString()] = v.count });

    // 8️⃣ Get comment counts
    const commentsAgg = await UserComment.aggregate([
      { $match: { feedId: { $in: feedIds } } },
      { $group: { _id: "$feedId", count: { $sum: 1 } } }
    ]);
    const commentsCount = {};
    commentsAgg.forEach(c => { commentsCount[c._id.toString()] = c.count });

    // 9️⃣ Build final response
    const enrichedFeeds = feeds.map(feed => {
      const fid = feed._id.toString();
      const folder = feed.type === "video" ? "videos" : "images";
      const contentUrl = feed.contentUrl ? `${host}/uploads/${folder}/${path.basename(feed.contentUrl)}` : null;

      return {
        feedId: fid,
        type: feed.type,
        language: feed.language,
        category: feed.category,
        contentUrl,
        likesCount: likesCount[fid] || 0,
        downloadsCount: downloadsCount[fid] || 0,
        shareCount: sharesCount[fid] || 0,
        viewsCount: viewsCount[fid] || 0,
        commentsCount: commentsCount[fid] || 0,
        isLiked: likedFeedIds.includes(fid),
        isSaved: savedFeedIds.includes(fid)
      };
    });

    res.status(200).json({ message: "Filtered feeds retrieved successfully", feeds: enrichedFeeds });

  } catch (err) {
    console.error("Error fetching filtered feeds by accountId:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};










exports.getUserInfoAssociatedFeed = async (req, res) => {
  try {
    let feedId = req.params.feedId || req.query.feedId;
    if (!feedId) {
      console.log
      return res.status(400).json({ message: "feedId is required" });
    }
    feedId = feedId.trim();

    const host = `${req.protocol}://${req.get("host")}`;

    const feedWithCreator = await mongoose.connection
      .collection("Feeds")
      .aggregate([
        // 1️⃣ Match feed by ID
        { $match: { _id: new mongoose.Types.ObjectId(feedId) } },

        // 2️⃣ Lookup Account
        {
          $lookup: {
            from: "Accounts",
            localField: "createdByAccount",
            foreignField: "_id",
            as: "account",
          },
        },
        { $unwind: "$account" },

        // 3️⃣ Lookup ProfileSettings
        {
          $lookup: {
            from: "ProfileSettings",
            let: { userId: "$account.userId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      "$userId",
                      {
                        $cond: [
                          { $eq: [{ $type: "$$userId" }, "string"] },
                          { $toObjectId: "$$userId" },
                          "$$userId",
                        ],
                      },
                    ],
                  },
                },
              },
              {
                $project: {
                  bio: 1,
                  displayName: 1,
                  profileAvatar: 1,
                  userName:1,
                },
              },
            ],
            as: "profile",
          },
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

        // 4️⃣ Lookup total posts by this account
        {
          $lookup: {
            from: "Feeds",
            let: { accId: "$createdByAccount" },
            pipeline: [
              { $match: { $expr: { $eq: ["$createdByAccount", "$$accId"] } } },
              { $count: "totalPosts" },
            ],
            as: "postStats",
          },
        },
        {
          $addFields: {
            totalPosts: {
              $ifNull: [{ $arrayElemAt: ["$postStats.totalPosts", 0] }, 0],
            },
          },
        },

        // 5️⃣ Final response fields
        {
          $project: {
            _id: 1,
            totalPosts: 1,
            "profile.displayName": 1,
            "profile.bio": 1,
            "profile.profileAvatar": 1,
            "profile.userName":1,
          },
        },
      ])
      .toArray();

    if (!feedWithCreator || feedWithCreator.length === 0) {
      return res.status(404).json({ message: "Feed not found" });
    }

    // ✅ Add host to profileAvatar if exists
    let data = feedWithCreator[0];
    if (data.profile && data.profile.profileAvatar) {
      data.profile.profileAvatar = `${host}/${data.profile.profileAvatar.replace(/\\/g, "/")}`;
    }

    res.status(200).json({
      message: "Feed with creator details fetched successfully",
      data,
    });
  } catch (err) {
    console.error("Error fetching feed with user profile:", err);
    res.status(500).json({
      message: "Error fetching feed with user profile",
      error: err.message,
    });
  }
};

















