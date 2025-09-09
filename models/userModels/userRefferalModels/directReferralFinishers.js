const mongoose = require('mongoose');

const DirectFinisherSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  side: { type: String, enum: ['left', 'right'], required: true },
  status: { type: String, enum: ['incomplete', 'finished'], default: 'incomplete' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

DirectFinisherSchema.index({ parentId: 1, childId: 1 }, { unique: true });
DirectFinisherSchema.index({ parentId: 1, side: 1, status: 1 });
DirectFinisherSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('DirectFinisher', DirectFinisherSchema,'DirectFinishers');
