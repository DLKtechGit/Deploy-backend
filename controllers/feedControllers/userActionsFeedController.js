const UserFeedActions = require("../../models/userFeedInterSectionModel.js");
const Feeds = require("../../models/feedModel.js");
const { getActiveUserAccount } = require('../../middlewares/creatorAccountactiveStatus.js');
const UserComment =require("../../models/userModels/userCommentModel.js");
const CommentLike = require("../../models/userModels/commentsLikeModel.js");



exports.likeFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const feedId = req.body.feedId;

  if (!userId || !feedId) return res.status(400).json({ message: "userId and feedId required" });

  try {
    const result = await UserFeedActions.findOneAndUpdate(
      { userId },
      { $addToSet: { likedFeeds: feedId } }, // add if not exists
      { upsert: true, new: true }
    );

    const isLiked = result.likedFeeds.includes(feedId);

    res.status(200).json({
      message: isLiked ? "Liked successfully" : "Already liked",
      liked: true,
      likedFeeds: result.likedFeeds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};




exports.saveFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const feedId = req.body.feedId;

  if (!userId || !feedId) return res.status(400).json({ message: "userId and feedId required" });

  try {
    const result = await UserFeedActions.findOneAndUpdate(
      { userId },
      { $addToSet: { savedFeeds: feedId } },
      { upsert: true, new: true }
    );

    const isSaved = result.savedFeeds.includes(feedId);

    res.status(200).json({
      message: isSaved ? "Saved successfully" : "Already saved",
      saved: true,
      savedFeeds: result.savedFeeds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};



exports.downloadFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const feedId = req.body.feedId;

  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!feedId) return res.status(400).json({ message: "feedId is required" });

  try {
    // Record the download (always increment)
    const download = await UserFeedActionInteraction.create({
      userId,
      feedId,
      type: "download",
      downloadedAt: new Date(),
    });

    // Fetch the feed to get the download link
    const feed = await Feed.findById(feedId).select("contentUrl fileUrl downloadUrl");
    if (!feed) return res.status(404).json({ message: "Feed not found" });

    res.status(201).json({
      message: "Download recorded successfully",
      action: download,
      downloadLink: feed.downloadUrl || feed.fileUrl || feed.contentUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};




exports.shareFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const { feedId, shareChannel, shareTarget } = req.body;

  if (!userId || !feedId) return res.status(400).json({ message: "userId and feedId required" });

  try {
    const result = await UserFeedActions.findOneAndUpdate(
      { userId },
      {
        $push: {
          sharedFeeds: { feedId, shareChannel, shareTarget, sharedAt: new Date() }
        }
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: "Feed shared successfully",
      sharedFeeds: result.sharedFeeds
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};



exports.postComment = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const { feedId, commentText, parentCommentId } = req.body;

  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!feedId) return res.status(400).json({ message: "feedId is required" });
  if (!commentText) return res.status(400).json({ message: "commentText is required" });

  try {
    // Optional: check if parentCommentId exists
    if (parentCommentId) {
      const parentComment = await UserComment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(400).json({ message: "Parent comment not found" });
      }
    }

    const comment = await UserComment.create({
      userId,
      feedId,
      commentText,
      parentCommentId: parentCommentId || null
    });

    res.status(201).json({
      message: "Comment posted successfully",
      comment
    });
  } catch (err) {
    console.error("Error posting comment:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.postView = async (req, res) => {
  const userId = req.Id || req.body.userId; // optional, for anonymous views
  const { feedId, watchDuration } = req.body;

  if (!feedId) return res.status(400).json({ message: "feedId is required" });

  try {
    // Create a new view entry
    const view = await UserView.create({
      userId: userId || null, // allow anonymous views
      feedId,
      watchDuration: watchDuration || 0
    });

    res.status(201).json({
      message: "View recorded successfully",
      view
    });
  } catch (err) {
    console.error("Error recording view:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUserSavedFeeds = async (req, res) => {
  const userId = req.Id || req.body.userId;

  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const userActions = await UserFeedActions.findOne({ userId })
      .populate("savedFeeds", "contentUrl fileUrl downloadUrl type") // select only URLs
      .lean();

    if (!userActions || !userActions.savedFeeds.length) {
      return res.status(404).json({ message: "No saved feeds found" });
    }

    // Map to only URLs
    const savedFeedUrls = userActions.savedFeeds.map(feed => {
      const folder = feed.type === "video" ? "videos" : "images";
      return feed.downloadUrl || feed.fileUrl || (feed.contentUrl ? `http://192.168.1.48:5000/uploads/${folder}/${path.basename(feed.contentUrl)}` : null);
    }).filter(Boolean); // remove nulls

    res.status(200).json({
      message: "Saved feed URLs retrieved successfully",
      savedFeedUrls
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUserDownloadedFeeds = async (req, res) => {
  const userId = req.Id || req.body.userId;

  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const userActions = await UserFeedActions.findOne({ userId })
      .populate("downloadedFeeds", "contentUrl fileUrl downloadUrl type")
      .lean();

    if (!userActions || !userActions.downloadedFeeds.length) {
      return res.status(404).json({ message: "No downloaded feeds found" });
    }

    const downloadedFeedUrls = userActions.downloadedFeeds.map(feed => {
      const folder = feed.type === "video" ? "videos" : "images";
      return feed.downloadUrl || feed.fileUrl || (feed.contentUrl ? `http://192.168.1.48:5000/uploads/${folder}/${path.basename(feed.contentUrl)}` : null);
    }).filter(Boolean);

    res.status(200).json({
      message: "Downloaded feed URLs retrieved successfully",
      downloadedFeedUrls
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getUserLikedFeeds = async (req, res) => {
  const userId = req.Id || req.body.userId;

  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const userActions = await UserFeedActions.findOne({ userId })
      .populate("likedFeeds", "contentUrl fileUrl downloadUrl type")
      .lean();

    if (!userActions || !userActions.likedFeeds.length) {
      return res.status(404).json({ message: "No liked feeds found" });
    }

    const likedFeedUrls = userActions.likedFeeds.map(feed => {
      const folder = feed.type === "video" ? "videos" : "images";
      return feed.downloadUrl || feed.fileUrl || (feed.contentUrl ? `http://192.168.1.48:5000/uploads/${folder}/${path.basename(feed.contentUrl)}` : null);
    }).filter(Boolean);

    res.status(200).json({
      message: "Liked feed URLs retrieved successfully",
      likedFeedUrls
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.commentLike = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const { commentId } = req.body;

  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!commentId) return res.status(400).json({ message: "commentId is required" });

  try {
    // Check if user already liked the comment
    const existingLike = await CommentLike.findOne({ userId, commentId });

    if (existingLike) {
      // Unlike: remove the like
      await CommentLike.deleteOne({ _id: existingLike._id });
      const likeCount = await CommentLike.countDocuments({ commentId });
      return res.status(200).json({
        message: "Comment unliked",
        liked: false,
        likeCount,
      });
    }

    // Like: create new
    await CommentLike.create({ userId, commentId });
    const likeCount = await CommentLike.countDocuments({ commentId });

    res.status(201).json({
      message: "Comment liked",
      liked: true,
      likeCount,
    });
  } catch (err) {
    console.error("Error toggling comment like:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};



