const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      select: false,
    },
    categoryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    categoryCodeKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      select: false,
    },
    metalType: {
      type: String,
      enum: ["GOLD", "SILVER"],
      required: true,
      index: true,
    },
    stockTypes: [
      {
        type: String,
        enum: ["TAG", "TRAY"],
      },
    ],
  },
  {
    timestamps: true,
  }
);

categorySchema.pre("validate", function setNameKey() {
  if (this.name) {
    this.nameKey = this.name.trim().toLowerCase();
  }

  if (this.categoryCode) {
    this.categoryCode = this.categoryCode.trim().toUpperCase();
    this.categoryCodeKey = this.categoryCode;
  }

  if (this.metalType) {
    this.metalType = this.metalType.trim().toUpperCase();
  }
});

categorySchema.index({ metalType: 1, nameKey: 1 }, { unique: true });
categorySchema.index({ metalType: 1, categoryCodeKey: 1 });
categorySchema.index({ metalType: 1, stockTypes: 1 });

module.exports = mongoose.model("Category", categorySchema);
