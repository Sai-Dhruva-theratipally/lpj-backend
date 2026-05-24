const { body, param, query, validationResult } = require("express-validator");

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

const mongoIdParam = [
  param("id").isMongoId().withMessage("Valid tray id is required"),
  validateRequest,
];

const createTrayValidation = [
  body("trayName").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("name").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body().custom((value) => {
    if (!value.trayCode && !value.code) {
      throw new Error("Tray id is required");
    }

    if (!value.trayName && !value.name) {
      throw new Error("Tray name is required");
    }

    return true;
  }),
  body("trayCode").optional().trim().notEmpty().withMessage("Tray id cannot be empty"),
  body("code").optional().trim().notEmpty().withMessage("Tray id cannot be empty"),
  body("metalType").trim().notEmpty().withMessage("Metal type is required"),
  body("category").optional().trim(),
  body("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a whole number greater than or equal to 0"),
  body("totalWeight").optional().isFloat({ min: 0 }).withMessage("Total weight must be greater than or equal to 0"),
  body("stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  body("purity").optional().trim(),
  body("description").optional().trim(),
  body("desc").optional().trim(),
  body("status").optional().isIn(["AVAILABLE", "ARCHIVED"]).withMessage("Invalid tray status"),
  validateRequest,
];

const bulkCreateTrayValidation = [
  body("items").isArray({ min: 1, max: 100 }).withMessage("Items must contain 1 to 100 trays"),
  body("items.*.trayName").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("items.*.name").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("items.*").custom((value) => {
    if (!value.trayName && !value.name) {
      throw new Error("Tray name is required");
    }

    return true;
  }),
  body("items.*.trayCode").optional().trim(),
  body("items.*.metalType").trim().notEmpty().withMessage("Metal type is required"),
  body("items.*.category").optional().trim(),
  body("items.*.quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a whole number greater than or equal to 0"),
  body("items.*.totalWeight").optional().isFloat({ min: 0 }).withMessage("Total weight must be greater than or equal to 0"),
  body("items.*.stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  body("items.*.purity").optional().trim(),
  body("items.*.description").optional().trim(),
  body("items.*.desc").optional().trim(),
  body("items.*.status").optional().isIn(["AVAILABLE", "ARCHIVED"]).withMessage("Invalid tray status"),
  validateRequest,
];

const updateTrayValidation = [
  param("id").isMongoId().withMessage("Valid tray id is required"),
  body("trayName").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("name").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("category").optional().trim().notEmpty().withMessage("Category cannot be empty"),
  body("metalType").optional().trim().notEmpty().withMessage("Metal type cannot be empty"),
  body("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a whole number greater than or equal to 0"),
  body("totalWeight").optional().isFloat({ min: 0 }).withMessage("Total weight must be greater than or equal to 0"),
  body("stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  body("purity").optional().trim(),
  body("description").optional().trim(),
  body("status").optional().isIn(["AVAILABLE", "ARCHIVED"]).withMessage("Invalid tray status"),
  validateRequest,
];

const stockChangeValidation = [
  param("id").isMongoId().withMessage("Valid tray id is required"),
  body("quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("totalWeight").isFloat({ gt: 0 }).withMessage("Total weight must be greater than 0"),
  body("stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  validateRequest,
];

const stockAdditionValidation = [
  param("id").isMongoId().withMessage("Valid tray id is required"),
  body("quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("totalWeight").isFloat({ gt: 0 }).withMessage("Total weight must be greater than 0"),
  body("stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  body("sellerName").trim().notEmpty().withMessage("Seller name is required"),
  body("purchaseDate").optional().isISO8601().withMessage("Purchase date must be a valid date"),
  validateRequest,
];

const stockChangeByIdentifierValidation = [
  body().custom((value) => {
    if (!value.identifier && !value.id && !value.trayId && !value.trayCode && !value.code && !value.trayName && !value.name) {
      throw new Error("Tray id or tray name is required");
    }

    return true;
  }),
  body("identifier").optional().trim().notEmpty().withMessage("Tray id or name cannot be empty"),
  body("id").optional().isMongoId().withMessage("Valid tray id is required"),
  body("trayId").optional().isMongoId().withMessage("Valid tray id is required"),
  body("trayCode").optional().trim().notEmpty().withMessage("Tray id cannot be empty"),
  body("code").optional().trim().notEmpty().withMessage("Tray id cannot be empty"),
  body("trayName").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("name").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("totalWeight").isFloat({ gt: 0 }).withMessage("Total weight must be greater than 0"),
  body("stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  body("sellerName").trim().notEmpty().withMessage("Seller name is required"),
  body("purchaseDate").optional().isISO8601().withMessage("Purchase date must be a valid date"),
  validateRequest,
];

const saleItemsValidation = [
  body("items").isArray({ min: 1, max: 100 }).withMessage("Items must contain 1 to 100 sale entries"),
  body("items.*").custom((value) => {
    if (!value.identifier && !value.id && !value.trayId && !value.trayCode && !value.code && !value.trayName && !value.name) {
      throw new Error("Tray id or tray name is required");
    }

    return true;
  }),
  body("items.*.identifier").optional().trim().notEmpty().withMessage("Tray id or name cannot be empty"),
  body("items.*.id").optional().isMongoId().withMessage("Valid tray id is required"),
  body("items.*.trayId").optional().isMongoId().withMessage("Valid tray id is required"),
  body("items.*.trayCode").optional().trim().notEmpty().withMessage("Tray id cannot be empty"),
  body("items.*.code").optional().trim().notEmpty().withMessage("Tray id cannot be empty"),
  body("items.*.trayName").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("items.*.name").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("items.*.totalWeight").isFloat({ gt: 0 }).withMessage("Total weight must be greater than 0"),
  body("items.*.stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  validateRequest,
];

const bulkStockChangeValidation = [
  body("items").isArray({ min: 1, max: 100 }).withMessage("Items must contain 1 to 100 tray stock updates"),
  body("items.*").custom((value) => {
    if (!value.id && !value.trayId && !value.trayName && !value.name) {
      throw new Error("Tray id or tray name is required");
    }

    return true;
  }),
  body("items.*.id").optional().isMongoId().withMessage("Valid tray id is required"),
  body("items.*.trayId").optional().isMongoId().withMessage("Valid tray id is required"),
  body("items.*.trayName").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("items.*.name").optional().trim().notEmpty().withMessage("Tray name cannot be empty"),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  body("items.*.totalWeight").isFloat({ gt: 0 }).withMessage("Total weight must be greater than 0"),
  body("items.*.stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  body("items.*.sellerName").trim().notEmpty().withMessage("Seller name is required"),
  body("items.*.purchaseDate").optional().isISO8601().withMessage("Purchase date must be a valid date"),
  validateRequest,
];

const listTrayValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be at least 1"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("status").optional().isIn(["AVAILABLE", "SOLD", "ARCHIVED"]).withMessage("Invalid status"),
  query("category").optional().trim(),
  query("metalType").optional().trim(),
  query("trayCode").optional().trim(),
  query("trayName").optional().trim(),
  query("search").optional().trim(),
  validateRequest,
];

module.exports = {
  bulkCreateTrayValidation,
  bulkStockChangeValidation,
  createTrayValidation,
  listTrayValidation,
  mongoIdParam,
  saleItemsValidation,
  stockAdditionValidation,
  stockChangeByIdentifierValidation,
  stockChangeValidation,
  updateTrayValidation,
};
