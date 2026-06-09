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
  query("stockType").optional().isIn(["TAG", "TRAY", "RAW_METAL", "OLD_ORNAMENT"]).withMessage("Invalid stock type"),
  query("category").optional().trim(),
  query("seller").optional().trim(),
  query("customer").optional().trim(),
  query("groupBy").optional().isIn(["date", "customer", "item"]).withMessage("Invalid grouping"),
];

const stockReportValidation = [
  ...commonReportValidation,
  query("reportType")
    .optional()
    .isIn(["stock-summary", "stock-detailed"])
    .withMessage("Invalid stock report type"),
  validateRequest,
];

const salesReportValidation = [
  ...commonReportValidation,
  query("reportType")
    .optional()
    .isIn([
      "sales-summary",
      "sales-detailed",
      "cancelled-sales",
    ])
    .withMessage("Invalid sales report type"),
  validateRequest,
];

const salesInwardReportValidation = [
  ...commonReportValidation,
  query("reportType")
    .optional()
    .isIn(["sales-inward-summary", "sales-inward-detailed"])
    .withMessage("Invalid sales inward report type"),
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
  salesInwardReportValidation,
  salesReportValidation,
  stockReportValidation,
};
