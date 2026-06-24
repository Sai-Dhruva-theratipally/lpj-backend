const mongoose = require("mongoose");

const saleTransactionItemSchema = new mongoose.Schema(
  {
    inventoryId: {
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
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    trayCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    sellerName: {
      type: String,
      trim: true,
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
    isReturned: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { _id: false }
);

const customerReceivedItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ["RAW_METAL", "OLD_ORNAMENT"],
      required: true,
      index: true,
    },
    metalType: {
      type: String,
      enum: ["GOLD", "SILVER"],
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    weight: {
      type: Number,
      min: 0,
      required: true,
    },
    purity: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    isCancelled: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { _id: false }
);

const saleTransactionSchema = new mongoose.Schema(
  {
    saleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerName: {
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
      type: [saleTransactionItemSchema],
      validate: {
        validator(items) {
          return items.length > 0;
        },
        message: "Sale transaction must contain at least one item",
      },
    },
    totalItems: {
      type: Number,
      min: 0,
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
    receivedItems: {
      type: [customerReceivedItemSchema],
      default: [],
    },
    totalReceivedWeight: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "PARTIALLY_RETURNED", "RETURNED"],
      default: "ACTIVE",
      index: true,
    },
    returnedAt: {
      type: Date,
    },
    rates: {
      goldBuyRate: {
        type: Number,
        min: 0,
        default: 0,
      },
      goldSellRate: {
        type: Number,
        min: 0,
        default: 0,
      },
      silverBuyRate: {
        type: Number,
        min: 0,
        default: 0,
      },
      silverSellRate: {
        type: Number,
        min: 0,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

saleTransactionSchema.pre("validate", function normalizeReceivedItems() {
  if (!Array.isArray(this.receivedItems)) {
    return;
  }

  this.receivedItems.forEach((item) => {
    if (item.itemType) item.itemType = item.itemType.trim().toUpperCase();
    if (item.metalType) item.metalType = item.metalType.trim().toUpperCase();
    if (item.category) item.category = item.category.trim().toUpperCase();
    if (item.purity) item.purity = item.purity.trim().toUpperCase();
  });
});

saleTransactionSchema.index({ customerName: 1, date: 1 });
saleTransactionSchema.index({ "items.category": 1, date: 1 });
saleTransactionSchema.index({ "items.metalType": 1, date: 1 });
saleTransactionSchema.index({ "items.stockType": 1, date: 1 });
saleTransactionSchema.index({ "items.sellerName": 1, date: 1 });
saleTransactionSchema.index({ "items.stoneWeight": 1, date: 1 });
saleTransactionSchema.index({ "receivedItems.metalType": 1, date: 1 });
saleTransactionSchema.index({ "receivedItems.category": 1, date: 1 });

module.exports = mongoose.model("SaleTransaction", saleTransactionSchema);
