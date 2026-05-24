const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const {
  deleteDocument,
  getDocuments,
  searchDocuments,
  uploadDocument,
} = require("../controllers/documentController");
const { protect } = require("../middleware/authMiddleware");
const { uploadDocumentFile } = require("../services/cloudinaryService");

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
  .get(getDocuments)
  .post(
    uploadDocumentFile,
    body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 160 }),
    body("description").optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
    validateRequest,
    uploadDocument
  );

router.get("/search", query("q").optional().trim().isLength({ max: 160 }), validateRequest, searchDocuments);

router.delete("/:id", param("id").isMongoId().withMessage("Invalid document id"), validateRequest, deleteDocument);

module.exports = router;
