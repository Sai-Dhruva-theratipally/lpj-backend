const { query, validationResult } = require("express-validator");

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

const commonReportValidation = [
  query("fromDate").optional().isISO8601().withMessage("From date must be valid"),
  query("toDate").optional().isISO8601().withMessage("To date must be valid"),
  query("metalType").optional().isIn(["GOLD", "SILVER", "OTHERS"]).withMessage("Invalid metal type"),
  query("stockType").optional().isIn(["TAG", "TRAY"]).withMessage("Invalid stock type"),
  query("category").optional().trim(),
  query("seller").optional().trim(),
  query("customer").optional().trim(),
];

const stockReportValidation = [
  ...commonReportValidation,
  query("reportType")
    .optional()
    .isIn(["daily-stock-addition", "seller-wise-stock", "metal-wise-stock", "category-wise-stock", "tag-vs-tray-stock"])
    .withMessage("Invalid stock report type"),
  validateRequest,
];

const salesReportValidation = [
  ...commonReportValidation,
  query("reportType")
    .optional()
    .isIn([
      "daily-sales",
      "customer-wise-sales",
      "category-wise-sales",
      "metal-wise-sales",
      "tag-vs-tray-sales",
      "monthly-sales-summary",
      "cancelled-sales",
    ])
    .withMessage("Invalid sales report type"),
  validateRequest,
];

const inventoryReportValidation = [
  ...commonReportValidation,
  query("reportType")
    .optional()
    .isIn(["current-inventory", "available-stock", "sold-stock", "stone-weight"])
    .withMessage("Invalid inventory report type"),
  validateRequest,
];

module.exports = {
  inventoryReportValidation,
  salesReportValidation,
  stockReportValidation,
};
