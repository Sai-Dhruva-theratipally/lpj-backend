const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    categoryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    metalType: {
      type: String,
      enum: ["GOLD", "SILVER", "OTHERS"],
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

categorySchema.pre("validate", function normalizeFields() {
  if (this.name) {
    this.name = this.name.trim().toUpperCase();
  }

  if (this.categoryCode) {
    this.categoryCode = this.categoryCode.trim().toUpperCase();
  }

  if (this.metalType) {
    this.metalType = this.metalType.trim().toUpperCase();
  }
});

categorySchema.index({ metalType: 1, name: 1 }, { unique: true });
categorySchema.index({ metalType: 1, categoryCode: 1 });
categorySchema.index({ metalType: 1, stockTypes: 1 });

module.exports = mongoose.model("Category", categorySchema);
