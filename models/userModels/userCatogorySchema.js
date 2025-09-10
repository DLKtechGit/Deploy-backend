const mongoose = require("mongoose");

const userFeedCategorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // Categories the user is following or interested in
  categories: [
    {
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FeedCategory", // Assuming you have a FeedCategory model
        required: true,
      },
      isActive: {
        type: Boolean,
        default: true, // user can disable without unfollowing
      },
      followedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto update updatedAt before save
userFeedCategorySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("UserFeedCategory", userFeedCategorySchema,"UserFeedCategories");
// module.exports = mongoose.model('UserFeedCategory', userFeedCategorySchema, 'UserFeedCategory');