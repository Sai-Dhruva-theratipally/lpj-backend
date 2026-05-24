const mongoose = require("mongoose");

const metalRateSchema = new mongoose.Schema(
  {
    goldRate: {
      type: Number,
      required: true,
      min: 0,
    },
    silverRate: {
      type: Number,
      required: true,
      min: 0,
    },
    updatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = mongoose.model("MetalRate", metalRateSchema);
