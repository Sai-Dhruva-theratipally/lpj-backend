const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

sellerSchema.pre("validate", function normalizeName() {
  if (this.name) {
    this.name = this.name.trim().toUpperCase();
  }
});

module.exports = mongoose.model("Seller", sellerSchema);
