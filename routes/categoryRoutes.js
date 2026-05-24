const express = require("express");
const { createCategory, getCategories } = require("../controllers/categoryController");
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

router
  .route("/")
  .get(
    query("search").optional().trim(),
    query("stockType").optional().isIn(["TAG", "TRAY"]).withMessage("Invalid stock type"),
    query("metalType").optional().isIn(["GOLD", "SILVER"]).withMessage("Invalid metal type"),
    validateRequest,
    getCategories
  )
  .post(
    body("name").trim().notEmpty().withMessage("Category name is required"),
    body("categoryCode").trim().notEmpty().withMessage("Category code is required"),
    body("metalType").isIn(["GOLD", "SILVER"]).withMessage("Metal type is required"),
    body("stockType").optional().isIn(["TAG", "TRAY"]).withMessage("Invalid stock type"),
    validateRequest,
    createCategory
  );

module.exports = router;
