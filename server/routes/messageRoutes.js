const router = require('express').Router();
const { isValidObjectId } = require('mongoose');
const { protect } = require('../Middleware/authMiddleware');
const User = require('../models/User');
const { Conversation, Message } = require('../models/Conversation');

router.use(protect, (req, res, next) => {
  if (!['customer', 'provider'].includes(req.user.role)) return res.status(403).json({ message: 'Messaging is available to customers and providers.' });
  res.set('Cache-Control', 'no-store');
  next();
});
const owner = req => ({ [req.user.role]: req.user._id });

router.get('/', async (req, res) => {
  const other = req.user.role === 'customer' ? 'provider' : 'customer';
  res.json(await Conversation.find(owner(req)).sort({ updatedAt: -1, _id: -1 })
    .select(other + ' updatedAt').populate(other, 'name').limit(100));
});

router.post('/', async (req, res) => {
  const { provider } = req.body || {};
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Only customers can start a conversation.' });
  if (typeof provider !== 'string' || !isValidObjectId(provider)) return res.status(400).json({ message: 'Choose a valid provider.' });
  if (!await User.exists({ _id: provider, role: 'provider', active: { $ne: false }, suspended: { $ne: true } })) {
    return res.status(404).json({ message: 'Provider unavailable.' });
  }
  const filter = { customer: req.user._id, provider };
  const now = new Date();
  let thread;
  try {
    thread = await Conversation.findOneAndUpdate(filter, { $setOnInsert: { ...filter, createdAt: now, updatedAt: now } }, { upsert: true, new: true, timestamps: false });
  } catch (error) {
    if (error.code !== 11000) throw error;
    thread = await Conversation.findOne(filter);
  }
  res.json({ _id: thread._id });
});

router.param('id', async (req, res, next, id) => {
  if (!isValidObjectId(id) || !await Conversation.exists({ _id: id, ...owner(req) })) {
    return res.status(404).json({ message: 'Conversation not found.' });
  }
  next();
});

router.get('/:id', async (req, res) => {
  const { before } = req.query;
  if (before !== undefined && (typeof before !== 'string' || !isValidObjectId(before))) {
    return res.status(400).json({ message: 'Invalid message cursor.' });
  }
  const messages = await Message.find({ conversation: req.params.id, ...(before ? { _id: { $lt: before } } : {}) })
    .select('sender text createdAt').sort({ _id: -1 }).limit(51);
  res.json({ messages: messages.slice(0, 50).reverse(), hasMore: messages.length > 50 });
});

router.post('/:id', async (req, res) => {
  const { text } = req.body || {};
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) {
    return res.status(400).json({ message: 'Write a message of up to 2000 characters.' });
  }
  const message = await Message.create({ conversation: req.params.id, sender: req.user._id, text: text.trim() });
  await Conversation.updateOne({ _id: req.params.id }, { $max: { updatedAt: message.createdAt } }, { timestamps: false })
    .catch(() => console.warn('Conversation sorting timestamp could not be updated.'));
  res.status(201).json({ _id: message._id, sender: message.sender, text: message.text, createdAt: message.createdAt });
});

module.exports = router;
