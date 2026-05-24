const express = require("express");
const tagInventoryController = require("../controllers/tagInventoryController");
const { protect } = require("../middleware/authMiddleware");
const {
  cancelSaleValidation,
  createTagValidation,
  listTagValidation,
  sellTagValidation,
  tagIdParam,
  updateTagValidation,
} = require("../validations/tagInventoryValidation");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .post(createTagValidation, tagInventoryController.addTagStock)
  .get(listTagValidation, tagInventoryController.getTagStock);

router
  .route("/:id")
  .get(tagIdParam, tagInventoryController.getTagStockById)
  .patch(updateTagValidation, tagInventoryController.updateTagStock)
  .delete(tagIdParam, tagInventoryController.deleteTagStock);

router.patch("/:id/sell", sellTagValidation, tagInventoryController.sellTagStock);
router.patch("/:id/cancel-sale", cancelSaleValidation, tagInventoryController.cancelTagSale);

module.exports = router;
