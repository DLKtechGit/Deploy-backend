const mongoose = require('mongoose');

const ReferralEdgeSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level: { type: Number, required: true, default: 1 }, // level number in parent's tree
  side: { type: String, enum: ['left', 'right'], required: true },
  createdAt: { type: Date, default: Date.now }
});

ReferralEdgeSchema.index({ parentId: 1, level: 1, side: 1, createdAt: 1 });
ReferralEdgeSchema.index({ childId: 1 });
ReferralEdgeSchema.index({ parentId: 1, childId: 1 }, { unique: true }); // idempotency for edge creation

module.exports = mongoose.model('ReferralEdge', ReferralEdgeSchema,'ReferralEdges');
