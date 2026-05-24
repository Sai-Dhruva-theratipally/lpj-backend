const mongoose = require("mongoose");
const { TAG_CODE_END, TAG_CODE_START } = require("../utils/tagCodeConstants");

const inventorySchema = new mongoose.Schema(
  {
    stockType: {
      type: String,
      enum: ["TAG", "TRAY"],
      required: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
    },
    categoryCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    metalType: {
      type: String,
      enum: ["GOLD", "SILVER"],
      trim: true,
      uppercase: true,
    },
    tagId: {
      type: Number,
      min: TAG_CODE_START,
      max: TAG_CODE_END,
      sparse: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["AVAILABLE", "SOLD", "ARCHIVED"],
      default: "AVAILABLE",
      index: true,
    },
    tagNo: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
    },
    grossWeight: {
      type: Number,
      min: 0,
    },
    stoneWeight: {
      type: Number,
      min: 0,
      default: 0,
    },
    purity: {
      type: String,
      trim: true,
    },
    makingCharges: {
      type: Number,
      min: 0,
      default: 0,
    },
    pieces: {
      type: Number,
      min: 1,
      default: 1,
    },
    weight: {
      type: Number,
      min: 0,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seller",
    },
    sellerName: {
      type: String,
      trim: true,
    },
    purchaseDate: {
      type: Date,
    },
    saleDate: {
      type: Date,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    trayCode: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
    },
    trayName: {
      type: String,
      trim: true,
    },
    trayNameKey: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
      select: false,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    quantity: {
      type: Number,
      min: 0,
    },
    totalWeight: {
      type: Number,
      min: 0,
    },
    averageWeight: {
      type: Number,
      min: 0,
      default: 0,
    },
    stockEntries: [
      {
        seller: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Seller",
        },
        sellerName: {
          type: String,
          trim: true,
          required: true,
        },
        quantity: {
          type: Number,
          min: 1,
          required: true,
        },
        totalWeight: {
          type: Number,
          min: 0,
          required: true,
        },
        stoneWeight: {
          type: Number,
          min: 0,
          default: 0,
        },
        purchaseDate: {
          type: Date,
          required: true,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.trayNameKey;
        return ret;
      },
    },
    toObject: {
      transform(doc, ret) {
        delete ret.trayNameKey;
        return ret;
      },
    },
  }
);

inventorySchema.pre("validate", function validateStockShape() {
  if (this.stockType === "TAG") {
    if (!this.tagId) {
      this.invalidate("tagId", "12 digit tag code is required for tag inventory");
    } else if (!/^\d{12}$/.test(String(this.tagId))) {
      this.invalidate("tagId", "Tag code must be exactly 12 digits");
    }

    if (!this.category) {
      this.invalidate("category", "Category is required for tag inventory");
    }

    if (!this.categoryCode) {
      this.invalidate("categoryCode", "Category code is required for tag inventory");
    }

    if (!this.metalType) {
      this.invalidate("metalType", "Metal type is required for tag inventory");
    }

    if (!this.sellerName) {
      this.invalidate("sellerName", "Seller name is required for tag inventory");
    }

    if (!this.purchaseDate) {
      this.invalidate("purchaseDate", "Purchase date is required for tag inventory");
    }

    if (this.weight === undefined || this.weight === null || this.weight <= 0) {
      this.invalidate("weight", "Gross weight must be greater than 0");
    }

    if (this.stoneWeight === undefined || this.stoneWeight === null) {
      this.stoneWeight = 0;
    }

    this.grossWeight = this.weight;
    this.pieces = this.pieces || 1;
    this.tagNo = String(this.tagId);
  }

  if (this.stockType === "TRAY") {
    if (!this.metalType) {
      this.invalidate("metalType", "Metal type is required for tray inventory");
    }

    if (!this.trayName && this.trayCode) {
      this.trayName = this.trayCode;
    }

    if (!this.trayName) {
      this.invalidate("trayName", "Tray name is required for tray inventory");
    } else {
      this.trayNameKey = this.trayName.trim().toLowerCase();
    }

    if (this.quantity === undefined || this.quantity === null) {
      this.quantity = 0;
    }

    if (this.totalWeight === undefined || this.totalWeight === null) {
      this.totalWeight = 0;
    }

    if (this.stoneWeight === undefined || this.stoneWeight === null) {
      this.stoneWeight = 0;
    }

    this.grossWeight = this.totalWeight;
  }
});

inventorySchema.pre("save", function calculateAverageWeight() {
  if (this.stockType !== "TRAY") {
    return;
  }

  this.averageWeight = this.quantity > 0 ? Number((this.totalWeight / this.quantity).toFixed(3)) : 0;
  this.grossWeight = this.totalWeight;
});

inventorySchema.index({ stockType: 1, category: 1 });
inventorySchema.index({ stockType: 1, metalType: 1, category: 1 });
inventorySchema.index({ stockType: 1, metalType: 1, categoryCode: 1 });
inventorySchema.index({ stockType: 1, metalType: 1 });
inventorySchema.index({ stockType: 1, tagId: 1 });
inventorySchema.index({ stockType: 1, sellerName: 1 });
inventorySchema.index({ stockType: 1, status: 1 });
inventorySchema.index({ stockType: 1, purchaseDate: 1 });
inventorySchema.index({ trayCode: 1, stockType: 1 });
inventorySchema.index({ trayNameKey: 1, stockType: 1 });

module.exports = mongoose.model("Inventory", inventorySchema);
