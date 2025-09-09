const mongoose = require("mongoose");

const UserFeedActionsSchema = new mongoose.Schema({
  // Either userId OR accountId will be present
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },

  likedFeeds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feed" }],
  savedFeeds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feed" }],
  downloadedFeeds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feed" }],

  sharedFeeds: [
    {
      feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed" },
      shareChannel: {
        type: String,
        enum: [
          "whatsapp",
          "facebook",
          "twitter",
          "instagram",
          "linkedin",
          "email",
          "copy_link",
          "other"
        ],
      },
      shareTarget: { type: String }, // optional: group, timeline, direct, etc.
      sharedAt: { type: Date, default: Date.now },
    },
  ],
}, { timestamps: true });

/**
 * ✅ Indexing for performance & uniqueness
 * - Either userId or accountId must be unique separately
 */
UserFeedActionsSchema.index({ userId: 1 }, { unique: true, sparse: true });
UserFeedActionsSchema.index({ accountId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("UserFeedActions", UserFeedActionsSchema, "UserFeedActions");
