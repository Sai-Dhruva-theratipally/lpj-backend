const express = require("express");
const { getMetalRates, updateMetalRates } = require("../controllers/metalRateController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getMetalRates);
router.post("/update", protect, updateMetalRates);

module.exports = router;
