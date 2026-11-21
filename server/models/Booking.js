const mongoose = require("mongoose");

const demoPaymentSchema = new mongoose.Schema({
  reference: { type: String, required: true },
  serviceName: { type: String, required: true },
  method: { type: String, enum: ["demo-card", "demo-eft"], required: true },
  status: { type: String, enum: ["confirmed"], required: true },
  amount: { type: Number, min: 0, required: true },
  paidAt: { type: Date, required: true },
  receiptStatus: { type: String, enum: ["pending", "sending", "preview", "submitted", "failed", "uncertain"], required: true },
  receiptAttemptedAt: Date,
}, { _id: false });

const bookingSchema = new mongoose.Schema(
  {
    occupiedMinutes: { type: [Number], default: undefined },
    timeline: [{ type: { type: String }, message: String, bookingStatus: String, appointmentDate: Date, createdAt: { type: Date, default: Date.now }, readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] }],
    proposedDate: Date,
    payment: { method: { type: String, enum: ['cash', 'simulation'] }, status: { type: String, enum: ['pending','paid','failed'], default: 'pending' }, reference: String, paidAt: Date },
    agreedPrice: { type: Number, min: 0 },
    photos: { type: [String], default: undefined },
    demoPayment: demoPaymentSchema,
    review: {
      type: new mongoose.Schema({
        moderation: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
        riskScore: { type: Number, default: 0 },
        riskSignals: [String],
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, trim: true, maxlength: 1000, required: true },
        createdAt: { type: Date, default: Date.now },
      }, { _id: false }),
      default: undefined,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    bookingDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true },
);

// Missing fields on existing bookings are excluded; no existing records are rewritten.
bookingSchema.index({ provider: 1, occupiedMinutes: 1 }, { unique: true, partialFilterExpression: { occupiedMinutes: { $exists: true }, status: { $in: ["pending", "confirmed"] } } });
bookingSchema.index({ provider: 1, status: 1 });
module.exports = mongoose.model("Booking", bookingSchema);
