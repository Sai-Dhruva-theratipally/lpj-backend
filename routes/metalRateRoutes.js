const express = require("express");
const { getMetalRates } = require("../controllers/metalRateController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getMetalRates);

module.exports = router;
