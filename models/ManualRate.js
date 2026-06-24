const mongoose = require("mongoose");

const manualRateSchema = new mongoose.Schema(
  {
    metalType: {
      type: String,
      enum: ["GOLD", "SILVER"],
      required: true,
      index: true,
    },
    rateType: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true,
      index: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    recordedBy: {
      type: String,
      trim: true,
      uppercase: true,
    },
    source: {
      type: String,
      enum: ["STOCK_TRANSACTION", "SALE_TRANSACTION", "MANUAL_ENTRY"],
      default: "MANUAL_ENTRY",
      index: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "transactionType",
      sparse: true,
    },
    transactionType: {
      type: String,
      enum: ["StockTransaction", "SaleTransaction"],
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for getting latest rates by metal type and rate type
manualRateSchema.index({ metalType: 1, rateType: 1, createdAt: -1 });

module.exports = mongoose.model("ManualRate", manualRateSchema);
