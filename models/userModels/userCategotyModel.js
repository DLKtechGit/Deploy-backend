const mongoose = require("mongoose");

const UserCategorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

  // Categories user is interested in
  interestedCategories: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Category" }
  ],

  // Categories user is NOT interested in
  nonInterestedCategories: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Category" }
  ],

  active: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure uniqueness per user
UserCategorySchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model("UserCategory", UserCategorySchema,"UserCategorys");
