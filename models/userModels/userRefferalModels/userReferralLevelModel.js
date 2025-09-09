const mongoose = require("mongoose");

const UserLevelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // From old schema
  level: { type: Number, required: true }, // renamed from userLevel for clarity
  levelLimit: { type: Number }, // optional, in case you still need to cap referrals per level
  tier: { type: Number, required: true },
  referringPeople: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // who this user referred

  // From new schema
  leftTreeCount: { type: Number, default: 0 },
  rightTreeCount: { type: Number, default: 0 },
  threshold: { type: Number, required: true }, // e.g., 50 for L1

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance & uniqueness
UserLevelSchema.index({ userId: 1, level: 1 }, { unique: true });
UserLevelSchema.index({ userId: 1 });

// Auto update `updatedAt` on save
UserLevelSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("UserLevel", UserLevelSchema, "UserLevels");
