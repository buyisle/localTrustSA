
const express = require("express");
const router = express.Router();

const Service = require("../models/Service");
const Booking = require("../models/Booking");
const mongoose = require("mongoose");
const { serviceDetails } = require("../lib/validation");
const { protect } = require("../Middleware/authMiddleware");

// Get all services
router.get("/", async (req, res) => {
  try {
    let pipeline;
    try { pipeline = require('../lib/directory').directoryPipeline(req.query); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    res.json(await Service.aggregate(pipeline));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch services" });
  }
});

// Create service (providers only)
router.post("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({
        message: "Only providers can create services"
      });
    }

    const { title, category, description, price, location } = req.body;

    if (!serviceDetails(req.body)) {
      return res.status(400).json({
        message: "Valid service details are required"
      });
    }

    const service = await Service.create({
      provider: req.user._id,
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      price,
      location: location.trim()
      , ...(req.body.coordinates ? { coordinates: req.body.coordinates } : {})
    });

    res.status(201).json(service);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create service" });
  }
});

module.exports = router;

router.get("/my", protect, async (req, res) => {
  if (req.user.role !== "provider") return res.status(403).json({ message: "Only providers can manage services" });
  res.json(await Service.find({ provider: req.user._id }).sort({ createdAt: -1 }));
});

router.patch("/:id", protect, async (req, res) => {
  if (req.user.role !== "provider") return res.status(403).json({ message: "Only providers can manage services" });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid service ID" });
  if (!serviceDetails(req.body) || typeof req.body.active !== "boolean") return res.status(400).json({ message: "Valid service details and availability are required" });
  const { title, category, description, price, location, active } = req.body;
  const service = await Service.findOneAndUpdate({ _id: req.params.id, provider: req.user._id }, { $set: { title: title.trim(), category, description: description.trim(), price, location: location.trim(), active, ...(req.body.coordinates ? { coordinates: req.body.coordinates } : {}) } }, { new: true, runValidators: true });
  if (!service) return res.status(404).json({ message: "Service not found in your listings" });
  res.json(service);
});

router.get("/:id/reviews", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid service ID" });
  const service = await Service.findById(req.params.id).select('provider active');
  if (!service || service.active === false) return res.status(404).json({ message: "Service unavailable" });
  const reviews = await Booking.aggregate([
    { $match: { provider: service.provider, status: 'completed', 'review.rating': { $exists: true }, 'review.moderation': { $in: ['approved', null] } } },
    { $lookup: { from: 'users', localField: 'customer', foreignField: '_id', as: 'reviewer' } },
    { $match: { 'reviewer.demo': { $ne: true }, 'reviewer.email': { $not: /@demo\.localtrust\.test$/i } } },
    { $sort: { 'review.createdAt': -1 } }, { $limit: 50 },
    { $project: { _id: 0, rating: '$review.rating', comment: '$review.comment', createdAt: '$review.createdAt', customer: { $ifNull: [{ $first: '$reviewer.name' }, 'Customer'] } } }
  ]);
  res.json(reviews);
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid service ID' });
  const pipeline = require('../lib/directory').directoryPipeline({});
  pipeline[0].$match._id = new mongoose.Types.ObjectId(req.params.id);
  pipeline.push(
    { $lookup: { from: 'users', localField: 'provider._id', foreignField: '_id', pipeline: [{ $project: { biography: 1, experience: 1 } }], as: 'profile' } },
    { $lookup: { from: 'services', localField: 'provider._id', foreignField: 'provider', let: { current: '$_id' }, pipeline: [
      { $match: { active: { $ne: false }, $expr: { $ne: ['$_id', '$$current'] } } },
      { $sort: { createdAt: -1, _id: 1 } }, { $limit: 12 }, { $project: { title: 1, category: 1, price: 1 } },
    ], as: 'offers' } },
    { $set: { biography: { $first: '$profile.biography' }, experience: { $first: '$profile.experience' } } },
    { $unset: 'profile' }
  );
  const [service] = await Service.aggregate(pipeline);
  if (!service) return res.status(404).json({ message: 'Service unavailable' });
  res.json(service);
});
