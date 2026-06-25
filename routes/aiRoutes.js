const express = require("express");
const multer = require("multer");
const aiController = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, and WEBP sale sheet images are supported"));
    }

    return cb(null, true);
  },
});

router.use(protect);

router.post("/sale-import/extract", upload.array("images", 5), aiController.extractSaleImport);

module.exports = router;
