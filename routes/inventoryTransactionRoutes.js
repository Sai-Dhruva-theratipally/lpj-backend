const express = require("express");
const inventoryTransactionController = require("../controllers/inventoryTransactionController");
const { protect } = require("../middleware/authMiddleware");
const {
  lookupValidation,
  saleTransactionValidation,
  stockTransactionValidation,
} = require("../validations/inventoryTransactionValidation");

const router = express.Router();

router.use(protect);

router.get("/lookup/:identifier", lookupValidation, inventoryTransactionController.lookupInventory);
router.post("/stock-transactions", stockTransactionValidation, inventoryTransactionController.createStockTransaction);
router.post("/sale-transactions", saleTransactionValidation, inventoryTransactionController.createSaleTransaction);

module.exports = router;
