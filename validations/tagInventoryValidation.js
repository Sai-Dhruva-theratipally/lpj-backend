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

const tagIdParam = [
  param("id")
    .custom((value) => /^[A-Z0-9]{6}\d{5}$/i.test(value) || /^\d+$/.test(value) || /^[a-f\d]{24}$/i.test(value))
    .withMessage("Valid tag code is required"),
  validateRequest,
];

const createTagValidation = [
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("categoryCode").optional().trim().notEmpty().withMessage("Category code cannot be empty"),
  body("metalType").isIn(["GOLD", "SILVER", "OTHERS"]).withMessage("Metal type is required"),
  body("pieces").optional().isInt({ min: 1 }).withMessage("Pieces must be at least 1"),
  body("weight").isFloat({ gt: 0 }).withMessage("Gross weight must be greater than 0"),
  body("stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  body("sellerName").trim().notEmpty().withMessage("Seller name is required"),
  body().custom((value) => {
    if (!value.date && !value.purchaseDate) {
      throw new Error("Purchase date is required");
    }

    return true;
  }),
  body("date").optional().isISO8601().withMessage("Date must be valid"),
  body("purchaseDate").optional().isISO8601().withMessage("Purchase date must be valid"),
  validateRequest,
];

const updateTagValidation = [
  param("id")
    .custom((value) => /^[A-Z0-9]{6}\d{5}$/i.test(value) || /^\d+$/.test(value) || /^[a-f\d]{24}$/i.test(value))
    .withMessage("Valid tag code is required"),
  body("tagId").not().exists().withMessage("Tag code cannot be changed"),
  body("id").not().exists().withMessage("Tag code cannot be changed"),
  body("stockType").not().exists().withMessage("Stock type cannot be changed"),
  body("category").optional().trim().notEmpty().withMessage("Category cannot be empty"),
  body("metalType").optional().isIn(["GOLD", "SILVER", "OTHERS"]).withMessage("Invalid metal type"),
  body("sellerName").optional().trim().notEmpty().withMessage("Seller name cannot be empty"),
  body("weight").optional().isFloat({ gt: 0 }).withMessage("Gross weight must be greater than 0"),
  body("stoneWeight").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("Stone weight must be greater than or equal to 0"),
  body("date").optional().isISO8601().withMessage("Date must be valid"),
  body("purchaseDate").optional().isISO8601().withMessage("Purchase date must be valid"),
  validateRequest,
];

const sellTagValidation = [
  param("id")
    .custom((value) => /^[A-Z0-9]{6}\d{5}$/i.test(value) || /^\d+$/.test(value) || /^[a-f\d]{24}$/i.test(value))
    .withMessage("Valid tag code is required"),
  body("saleDate").optional().isISO8601().withMessage("Sale date must be valid"),
  body("note").optional().trim(),
  validateRequest,
];

const cancelSaleValidation = [
  param("id")
    .custom((value) => /^[A-Z0-9]{6}\d{5}$/i.test(value) || /^\d+$/.test(value) || /^[a-f\d]{24}$/i.test(value))
    .withMessage("Valid tag code is required"),
  body("reason").optional().trim(),
  validateRequest,
];

const listTagValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be at least 1"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("status").optional().isIn(["AVAILABLE", "SOLD"]).withMessage("Invalid status"),
  query("category").optional().trim(),
  query("metalType").optional().isIn(["GOLD", "SILVER", "OTHERS"]).withMessage("Invalid metal type"),
  query("seller").optional().trim(),
  query("sellerName").optional().trim(),
  query("date").optional().isISO8601().withMessage("Date must be valid"),
  query("search").optional().trim(),
  validateRequest,
];

module.exports = {
  cancelSaleValidation,
  createTagValidation,
  listTagValidation,
  sellTagValidation,
  tagIdParam,
  updateTagValidation,
};
