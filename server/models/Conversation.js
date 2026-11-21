const mongoose = require('mongoose');
const user = { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true };
const conversation = new mongoose.Schema({ customer: user, provider: user }, { timestamps: true });
conversation.index({ customer: 1, provider: 1 }, { unique: true });
conversation.index({ provider: 1, updatedAt: -1 });

const message = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: user,
  text: { type: String, required: true, maxlength: 2000 },
}, { timestamps: true });
message.index({ conversation: 1, _id: -1 });

module.exports = { Conversation: mongoose.model('Conversation', conversation), Message: mongoose.model('Message', message) };
