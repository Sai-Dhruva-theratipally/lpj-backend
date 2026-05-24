const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { createSeller, getSellers } = require("../controllers/sellerController");
const { protect } = require("../middleware/authMiddleware");

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

router
  .route("/")
  .get(protect, query("search").optional().trim(), validateRequest, getSellers)
  .post(protect, body("name").trim().notEmpty().withMessage("Seller name is required"), validateRequest, createSeller);

module.exports = router;
