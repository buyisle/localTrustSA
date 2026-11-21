const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const { protect } = require("../Middleware/authMiddleware");
const receipt = require("../lib/demoReceipt");

const router = express.Router();
router.use("/:id/demo-payment", protect, (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.user.role !== "customer") return res.status(403).json({ message: "Demo checkout is for customers." });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid booking ID." });
  req.demoBookingFilter = { _id: req.params.id, customer: req.user._id };
  next();
});

async function deliver(filter, customer, retry) {
  const claimed = await Booking.findOneAndUpdate(
    { ...filter, "demoPayment.receiptStatus": retry ? { $in: ["pending", "failed"] } : "pending" },
    { $set: { "demoPayment.receiptStatus": "sending", "demoPayment.receiptAttemptedAt": new Date() } },
    { new: true }
  );
  if (!claimed) return (await Booking.findOne(filter))?.demoPayment;

  let receiptStatus;
  try {
    receiptStatus = await receipt.submitReceipt(claimed, customer);
  } catch {
    // Keep confirmation available even when mail setup fails unexpectedly.
    receiptStatus = "uncertain";
  }
  // An interrupted or ambiguous submission stays locked to prevent a second email.
  const updated = await Booking.findOneAndUpdate(
    { ...filter, "demoPayment.receiptStatus": "sending" },
    { $set: { "demoPayment.receiptStatus": receiptStatus } },
    { new: true }
  );
  return updated?.demoPayment;
}

router.post("/:id/demo-payment", async (req, res) => {
  if (!["demo-card", "demo-eft"].includes(req.body?.method) || Object.keys(req.body).length !== 1) {
    return res.status(400).json({ message: "Choose a simulated electronic payment method." });
  }
  const filter = req.demoBookingFilter;
  const booking = await Booking.findOne(filter).populate("service", "title");
  if (!booking) return res.status(404).json({ message: "Booking not found." });
  if (!booking.demoPayment) {
    if (!["confirmed", "completed"].includes(booking.status) || !booking.service?.title ||
        !Number.isFinite(booking.agreedPrice) || booking.agreedPrice < 0 ||
        (booking.payment?.method === "simulation" && booking.payment.status === "paid")) {
      return res.status(409).json({ message: "This booking is unavailable for demo checkout." });
    }
    const demoPayment = {
      reference: `DEMO-${booking._id}`,
      serviceName: booking.service.title,
      method: req.body.method,
      amount: booking.agreedPrice,
      status: "confirmed",
      paidAt: new Date(),
      receiptStatus: "pending",
    };
    const created = await Booking.findOneAndUpdate(
      { ...filter, status: booking.status, demoPayment: { $exists: false } },
      { $set: { demoPayment }, $push: { timeline: {
        type: "demo-payment", message: "DEMO payment confirmed. No real money was transferred.", createdAt: demoPayment.paidAt,
      } } },
      { new: true, runValidators: true }
    );
    if (!created && !(await Booking.exists({ ...filter, "demoPayment.status": "confirmed" }))) {
      return res.status(409).json({ message: "The booking changed. Refresh and try again." });
    }
  }
  res.json(await deliver(filter, req.user, false));
});

router.post("/:id/demo-payment/receipt", async (req, res) => {
  const payment = await deliver(req.demoBookingFilter, req.user, true);
  if (!payment) return res.status(404).json({ message: "Demo payment not found." });
  res.json(payment);
});

router.get("/:id/demo-payment/receipt-preview", async (req, res) => {
  const booking = await Booking.findOne({ ...req.demoBookingFilter, "demoPayment.receiptStatus": "preview" });
  if (!booking) return res.status(404).json({ message: "Receipt preview not found." });
  res.json({ html: receipt.receiptMessage(booking, req.user, receipt.previewSender).html });
});

module.exports = router;
