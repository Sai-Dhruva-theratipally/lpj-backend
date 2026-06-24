const express = require("express");
const { getLatestRates, getRateHistory, recordRate } = require("../controllers/manualRateController");
const { protect } = require("../middleware/authMiddleware");
const { body, query, validationResult } = require("express-validator");

const router = express.Router();

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    })),
  });
};

router.use(protect);

// Get latest rates
router.get("/latest", getLatestRates);

// Get rate history with filters
router.get(
  "/history",
  query("metalType").optional().isIn(["GOLD", "SILVER"]).withMessage("Invalid metal type"),
  query("rateType").optional().isIn(["BUY", "SELL"]).withMessage("Invalid rate type"),
  query("source")
    .optional()
    .isIn(["STOCK_TRANSACTION", "SALE_TRANSACTION", "MANUAL_ENTRY"])
    .withMessage("Invalid source"),
  query("fromDate").optional().isISO8601().withMessage("Invalid from date"),
  query("toDate").optional().isISO8601().withMessage("Invalid to date"),
  validateRequest,
  getRateHistory
);

// Record a new rate
router.post(
  "/",
  body("metalType").isIn(["GOLD", "SILVER"]).withMessage("Metal type must be GOLD or SILVER"),
  body("rateType").isIn(["BUY", "SELL"]).withMessage("Rate type must be BUY or SELL"),
  body("rate").isFloat({ min: 0 }).withMessage("Rate must be a non-negative number"),
  validateRequest,
  recordRate
);

module.exports = router;
