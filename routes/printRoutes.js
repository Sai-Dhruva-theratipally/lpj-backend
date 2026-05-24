const express = require("express");
const printController = require("../controllers/printController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/tag", printController.generateTagZpl);
router.post("/tray", printController.generateTrayZpl);
router.post("/batch", printController.generateBatchZpl);
router.post("/manual-text-tags", printController.generateManualTextTagZpl);

module.exports = router;
