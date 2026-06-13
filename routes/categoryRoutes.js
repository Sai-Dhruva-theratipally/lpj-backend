const express = require("express");
const { createCategory, getCategories, updateCategory, deleteCategory } = require("../controllers/categoryController");
const { protect } = require("../middleware/authMiddleware");
const { body, query, validationResult, param } = require("express-validator");

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
    query("metalType").optional().isIn(["GOLD", "SILVER", "OTHERS"]).withMessage("Invalid metal type"),
    validateRequest,
    getCategories
  )
  .post(
    body("name").trim().notEmpty().withMessage("Category name is required"),
    body("categoryCode").trim().notEmpty().withMessage("Category code is required"),
    body("metalType").isIn(["GOLD", "SILVER", "OTHERS"]).withMessage("Metal type is required"),
    body("stockType").optional().isIn(["TAG", "TRAY"]).withMessage("Invalid stock type"),
    validateRequest,
    createCategory
  );

router
  .route("/:id")
  .put(
    param("id").isMongoId().withMessage("Invalid category ID"),
    body("name").optional().trim().notEmpty().withMessage("Category name cannot be empty"),
    validateRequest,
    updateCategory
  )
  .delete(
    param("id").isMongoId().withMessage("Invalid category ID"),
    validateRequest,
    deleteCategory
  );

module.exports = router;
