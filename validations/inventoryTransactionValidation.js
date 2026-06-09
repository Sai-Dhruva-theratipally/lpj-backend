const { body, param, validationResult } = require("express-validator");

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

// Middleware to normalize date fields before validation
const normalizeDateFields = (req, res, next) => {
  if (req.body.date && typeof req.body.date === "string") {
    // Convert YYYY-MM-DD format to ISO8601 with time
    const dateMatch = req.body.date.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateMatch) {
      // Add T00:00:00Z to make it ISO8601 with time
      req.body.date = `${req.body.date}T00:00:00Z`;
    }
  }
  next();
};

const stockTransactionValidation = [
  normalizeDateFields,
  body("sellerName").trim().notEmpty().withMessage("Seller name is required"),
  body("date").isISO8601().withMessage("Date is required and must be in ISO8601 format"),
  body("items").isArray({ min: 1, max: 200 }).withMessage("At least one stock item is required"),
  body("items.*.metalType").isIn(["GOLD", "SILVER", "OTHERS"]).withMessage("Metal type is required"),
  body("items.*.stockType").isIn(["TAG", "TRAY"]).withMessage("Invalid inventory type"),
  body("items.*").custom((item) => {
    if (!item.categoryInput && !item.category && !item.categoryCode) {
      throw new Error("Category or tray search value is required");
    }

    return true;
  }),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("items.*.weight").isFloat({ gt: 0 }).withMessage("Gross weight must be greater than 0"),
  body("items.*.stoneWeight")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Stone weight must be greater than or equal to 0"),
  body("items.*.categoryInput").optional().trim().notEmpty().withMessage("Category or tray search value cannot be empty"),
  body("items.*.category").optional().trim().notEmpty().withMessage("Category cannot be empty"),
  body("items.*.categoryCode").optional().trim().notEmpty().withMessage("Category code cannot be empty"),
  validateRequest,
];

const saleTransactionValidation = [
  normalizeDateFields,
  body("customerName").trim().notEmpty().withMessage("Customer name is required"),
  body("date").isISO8601().withMessage("Date is required and must be in ISO8601 format"),
  body("items").isArray({ min: 1, max: 200 }).withMessage("At least one sale item is required"),
  body("items.*").custom((item) => {
    if (!item.inventoryId && !item.identifier && !item.barcode && !item.id) {
      throw new Error("Barcode or inventory id is required");
    }

    return true;
  }),
  body("items.*.inventoryId").optional().isMongoId().withMessage("Valid inventory id is required"),
  body("items.*.identifier").optional().trim().notEmpty().withMessage("Barcode cannot be empty"),
  body("items.*.barcode").optional().trim().notEmpty().withMessage("Barcode cannot be empty"),
  body("items.*.id").optional().trim().notEmpty().withMessage("Barcode cannot be empty"),
  body("items.*.quantity").optional().isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("items.*.weight").optional().isFloat({ gt: 0 }).withMessage("Gross weight must be greater than 0"),
  body("items.*.stoneWeight")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("Stone weight must be greater than or equal to 0"),
  body("receivedItems").optional().isArray({ max: 100 }).withMessage("Received items must be a list"),
  body("receivedItems.*.itemType")
    .optional()
    .isIn(["RAW_METAL", "OLD_ORNAMENT"])
    .withMessage("Received item type must be raw metal or old ornament"),
  body("receivedItems.*.metalType")
    .optional()
    .isIn(["GOLD", "SILVER"])
    .withMessage("Received metal must be gold or silver"),
  body("receivedItems.*.category").optional().trim().notEmpty().withMessage("Received category is required"),
  body("receivedItems.*.weight")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Received weight must be greater than 0"),
  body("receivedItems.*.purity").optional({ nullable: true }).trim(),
  body("receivedItems.*").custom((item) => {
    if (!item.itemType && !item.metalType && !item.category && !item.weight && !item.purity) {
      return true;
    }

    if (!item.itemType || !item.metalType || !item.category || item.weight === undefined || item.weight === "") {
      throw new Error("Received item type, metal, category, and weight are required");
    }

    if (item.itemType === "OLD_ORNAMENT" && !String(item.purity || "").trim()) {
      throw new Error("Purity is required for old ornaments");
    }

    return true;
  }),
  validateRequest,
];

const lookupValidation = [
  param("identifier").trim().notEmpty().withMessage("Barcode or id is required"),
  validateRequest,
];

module.exports = {
  lookupValidation,
  saleTransactionValidation,
  stockTransactionValidation,
};
