
const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");
const { parseBookingDate, availableAt, occupiedMinutes, DURATION } = require("../lib/scheduling");
const mongoose = require("mongoose");
const { protect } = require("../Middleware/authMiddleware");
const { canTransition } = require("../lib/validation");
const photos = require("../lib/bookingPhotos");
const email = require("../lib/bookingEmail");

router.get("/availability/:serviceId", async (req, res) => {
  const { serviceId } = req.params;
  const { day } = req.query;
  if (!mongoose.isValidObjectId(serviceId) || typeof day !== "string") {
    return res.status(400).json({ message: "Choose a valid service and appointment date." });
  }
  const start = parseBookingDate(`${day}T00:00+02:00`, new Date(0));
  const now = new Date();
  const today = new Date(now.getTime() + 2 * DURATION).toISOString().slice(0, 10);
  if (!start || day < today) return res.status(400).json({ message: "Choose today or a future date." });

  const service = await Service.findById(serviceId);
  if (!service || service.active === false) return res.status(404).json({ message: "Service not found." });
  const provider = await User.findById(service.provider).select("role active suspended availability");
  const reserved = await Booking.find({
    provider: service.provider,
    status: { $in: ["pending", "confirmed"] },
    bookingDate: { $gt: new Date(start.getTime() - DURATION), $lt: new Date(start.getTime() + 25 * DURATION) }
  }).select("bookingDate").lean();

  const slots = [];
  for (let minute = 0; minute < 1440; minute += 30) {
    const date = new Date(start.getTime() + minute * 60000);
    if (date > now && availableAt(provider, date) &&
        !reserved.some(booking => Math.abs(booking.bookingDate - date) < DURATION)) {
      slots.push(date.toISOString());
    }
  }
  res.set("Cache-Control", "no-store").json({ slots });
});

// Create booking (customers only)
router.post("/", (req, res, next) => req.user ? next() : protect(req, res, next), async (req, res) => {
  let stored = [];
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can book services"
      });
    }

    const { serviceId, bookingDate } = req.body || {};
    let images;
    try { images = photos.validate(req.body?.photos); }
    catch (error) { return res.status(400).json({ message: error.message }); }

    if (!mongoose.isValidObjectId(serviceId)) {
      return res.status(400).json({
        message: "Invalid service ID"
      });
    }

    const service = await Service.findById(serviceId);

    if (!service || service.active === false) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    const date = parseBookingDate(bookingDate);

    if (!date) {
      return res.status(400).json({
        message: "Choose a future date and time with an explicit timezone, to the nearest minute."
      });
    }

    const provider = await User.findById(service.provider);
    if (!availableAt(provider, date)) return res.status(409).json({ message: "This provider is unavailable at that time. Please choose another time." });
    const conflict = await Booking.exists({ provider: service.provider, status: { $in: ["pending", "confirmed"] }, bookingDate: { $gt: new Date(date.getTime() - DURATION), $lt: new Date(date.getTime() + DURATION) } });
    if (conflict) return res.status(409).json({ message: "This provider already has a booking at that time. Please choose another time." });
    stored = await photos.store(images);
    const booking = await Booking.create({
      occupiedMinutes: occupiedMinutes(date),
      timeline: [email.event('pending', date, 'Booking requested; awaiting provider confirmation.')],
      customer: req.user._id,
      provider: service.provider,
      service: service._id,
      bookingDate: date,
      agreedPrice: service.price,
      ...(stored.length ? { photos: stored } : {})
    });

    res.status(201).json({
      message: "Booking created successfully",
      booking
    });
    email.notify(booking, 'pending');
  } catch (error) {
    if (stored.length) await photos.remove(stored);
    if (error.code === 11000) return res.status(409).json({ message: "That appointment was just reserved. Refresh your bookings before trying another time." });
    console.error(error);
    res.status(500).json({ message: "Failed to create booking" });
  }
});

router.get('/:id/photos/:filename', protect, async (req, res, next) => {
  const { id, filename } = req.params;
  const role = req.user.role;
  if (!mongoose.isValidObjectId(id) || !photos.filenamePattern.test(filename) || !['customer', 'provider'].includes(role)) {
    return res.status(404).json({ message: 'Photo not found.' });
  }
  const visible = await Booking.exists({ _id: id, [role]: req.user._id, photos: filename });
  if (!visible) return res.status(404).json({ message: 'Photo not found.' });
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.sendFile(photos.photoPath(filename), error => {
    if (!error) return;
    if (error.status === 404 && !res.headersSent) return res.status(404).json({ message: 'Photo file unavailable.' });
    next(error);
  });
});

router.get('/:id/email-preview/:eventId', protect, async (req, res) => {
  if (req.user.role !== 'customer' || email.mode() !== 'preview' ||
      !mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.eventId)) {
    return res.status(404).json({ message: 'Email preview unavailable.' });
  }
  const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id, 'timeline._id': req.params.eventId });
  const event = booking?.timeline.id(req.params.eventId);
  if (!event?.bookingStatus) return res.status(404).json({ message: 'Email preview unavailable.' });
  const [provider, service] = await email.references(booking);
  res.set('Cache-Control', 'no-store').json({ html: email.message(booking, event, req.user, provider, service).html });
});

// Get logged-in user's bookings
router.get("/my", protect, async (req, res) => {
  try {
    const filter = req.user.role === "provider"
      ? { provider: req.user._id }
      : { customer: req.user._id };

    const bookings = await Booking.find(filter)
      .populate("service", "title category price location")
      .populate("customer", "name")
      .populate("provider", "name")
      .sort({ createdAt: -1 });

    res.set('X-Booking-Email-Mode', email.mode()).set('Access-Control-Expose-Headers', 'X-Booking-Email-Mode').status(200).json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
});

module.exports = router;

router.patch("/:id/status", protect, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID" });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  const owner = req.user.role === "provider" ? booking.provider : booking.customer;
  if (String(owner) !== String(req.user._id)) return res.status(403).json({ message: "This booking belongs to another user" });
  if (!canTransition(req.user.role, booking.status, req.body.status)) return res.status(409).json({ message: "This status change is not allowed" });
  if (req.body.status === "completed" && booking.bookingDate > new Date()) return res.status(409).json({ message: "A booking can only be completed after its scheduled time" });
  const updated = await Booking.findOneAndUpdate({ _id: booking._id, status: booking.status }, { $set: { status: req.body.status }, $push: { timeline: email.event(req.body.status, booking.bookingDate) } }, { new: true });
  if (!updated) return res.status(409).json({ message: "Booking changed. Refresh and try again" });
  res.json(updated);
  email.notify(updated, req.body.status);
});

router.post("/:id/review", protect, async (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ message: "Only customers can leave reviews" });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID" });
  const { rating, comment } = req.body;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== "string" || !comment.trim() || comment.length > 1000) return res.status(400).json({ message: "Choose a rating from 1 to 5 and write a review of up to 1000 characters" });
  const risk = require('../lib/intelligence').reviewRisk(comment);
  const booking = await Booking.findOneAndUpdate({ _id: req.params.id, customer: req.user._id, status: "completed", review: { $exists: false } }, { $set: { review: { rating, comment: comment.trim(), createdAt: new Date(), moderation: "pending", ...risk } }, $push: { timeline: { type: "review", message: "Review received for moderation", createdAt: new Date() } } }, { new: true, runValidators: true });
  if (!booking) return res.status(409).json({ message: "You can review your own completed booking once" });
  res.status(201).json(booking.review);
});
