const mongoose = require("mongoose");

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
      uppercase: true,
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
      trim: true,
      uppercase: true,
    },
    tagId: {
      type: String,
      trim: true,
      uppercase: true,
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
    printStatus: {
      type: String,
      enum: ["NONE", "PENDING_PRINT", "PRINTED"],
      default: "NONE",
      index: true,
    },
    printQueuedAt: {
      type: Date,
      index: true,
    },
    printedAt: {
      type: Date,
      index: true,
    },
    printCount: {
      type: Number,
      min: 0,
      default: 0,
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
      uppercase: true,
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
      uppercase: true,
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
      uppercase: true,
      sparse: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      uppercase: true,
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
          uppercase: true,
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
  }
);

inventorySchema.pre("validate", function validateStockShape() {
  if (this.category) {
    this.category = this.category.trim().toUpperCase();
  }
  if (this.sellerName) {
    this.sellerName = this.sellerName.trim().toUpperCase();
  }
  if (this.trayName) {
    this.trayName = this.trayName.trim().toUpperCase();
  }
  if (this.description) {
    this.description = this.description.trim().toUpperCase();
  }
  if (this.purity) {
    this.purity = this.purity.trim().toUpperCase();
  }
  if (this.categoryCode) {
    this.categoryCode = this.categoryCode.trim().toUpperCase();
  }
  if (this.tagId) {
    this.tagId = String(this.tagId).trim().toUpperCase();
  }

  if (this.stockType === "TAG") {
    if (!this.tagId) {
      this.invalidate("tagId", "Tag code is required for tag inventory");
    } else if (!/^[A-Z0-9]{6}\d{5}$/.test(String(this.tagId)) && !/^\d{12}$/.test(String(this.tagId))) {
      this.invalidate("tagId", "Tag code must be 6 category characters followed by 5 digits");
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
inventorySchema.index({ trayName: 1, stockType: 1 });

module.exports = mongoose.model("Inventory", inventorySchema);
