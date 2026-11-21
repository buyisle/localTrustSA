const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: true },
    demo: { type: Boolean, default: false },
    demoKey: { type: String },
    image: { type: String },
    coordinates: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number], default: undefined } },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    location: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

serviceSchema.index({ coordinates: '2dsphere' });
serviceSchema.index({ demoKey: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model("Service", serviceSchema);
