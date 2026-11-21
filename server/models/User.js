
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: true },
    suspended: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    demo: { type: Boolean, default: false },
    profilePhoto: { type: String, default: '' },
    biography: { type: String, maxlength: 1200, default: '' },
    experience: { type: String, maxlength: 500, default: '' },
    portfolio: [{ url: String, caption: { type: String, maxlength: 160 } }],
    availability: { days: [{ type: Number, min: 0, max: 6 }], startHour: { type: Number, default: 8 }, endHour: { type: Number, default: 17 } },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["customer", "provider", "admin"],
      default: "customer"
    },
    phone: {
      type: String,
      default: ""
    },
    location: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare passwords
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
