const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
      index: true,
    },
    fileType: {
      type: String,
      enum: ["IMAGE", "PDF"],
      required: true,
    },
    cloudinaryUrl: {
      type: String,
      required: true,
      trim: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

documentSchema.index({ title: 1, description: 1 });

module.exports = mongoose.model("Document", documentSchema);
