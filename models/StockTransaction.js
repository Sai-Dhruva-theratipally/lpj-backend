const mongoose = require("mongoose");

const stockTransactionItemSchema = new mongoose.Schema(
  {
    stockType: {
      type: String,
      enum: ["TAG", "TRAY"],
      required: true,
      index: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },
    tagId: {
      type: Number,
      index: true,
    },
    trayCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    categoryCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    metalType: {
      type: String,
      enum: ["GOLD", "SILVER", "OTHERS"],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      min: 1,
      required: true,
    },
    weight: {
      type: Number,
      min: 0,
      required: true,
    },
    stoneWeight: {
      type: Number,
      min: 0,
      default: 0,
    },
    sellerName: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const stockTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
    },
    sellerName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    items: {
      type: [stockTransactionItemSchema],
      validate: {
        validator(items) {
          return items.length > 0;
        },
        message: "Stock transaction must contain at least one item",
      },
    },
    totalItems: {
      type: Number,
      min: 1,
      required: true,
    },
    totalWeight: {
      type: Number,
      min: 0,
      required: true,
    },
    totalStoneWeight: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

stockTransactionSchema.index({ sellerName: 1, date: 1 });
stockTransactionSchema.index({ "items.category": 1, date: 1 });
stockTransactionSchema.index({ "items.metalType": 1, date: 1 });
stockTransactionSchema.index({ "items.stockType": 1, date: 1 });
stockTransactionSchema.index({ "items.stoneWeight": 1, date: 1 });

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
