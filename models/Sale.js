const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },
    stockType: {
      type: String,
      enum: ["TAG", "TRAY"],
      required: true,
      index: true,
    },
    tagId: {
      type: Number,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
      trim: true,
      default: "",
    },
    history: [
      {
        action: {
          type: String,
          enum: ["SOLD", "CANCELLED"],
          required: true,
        },
        note: {
          type: String,
          trim: true,
          default: "",
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Sale", saleSchema);
