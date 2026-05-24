const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema(
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
      unique: true,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

sellerSchema.pre("validate", function setNameKey() {
  if (this.name) {
    this.nameKey = this.name.trim().toLowerCase();
  }
});

module.exports = mongoose.model("Seller", sellerSchema);
