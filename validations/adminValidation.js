const { body, validationResult } = require("express-validator");

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

const resetDatabaseValidation = [
  body("password").notEmpty().withMessage("Password is required to reset database"),
  validateRequest,
];

const resetStockValidation = [
  body("password").notEmpty().withMessage("Password is required to reset stock"),
  body("stockType").optional().isIn(["TRAY", "TAG", "ALL"]).withMessage("Invalid stock type"),
  validateRequest,
];

const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
  validateRequest,
];

module.exports = { resetDatabaseValidation, resetStockValidation, changePasswordValidation };
