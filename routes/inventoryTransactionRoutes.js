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

// General endpoints
router.get("/suggestions", inventoryTransactionController.getSuggestions);
router.get("/lookup/:identifier", lookupValidation, inventoryTransactionController.lookupInventory);

// Bill endpoints - specific routes BEFORE parameterized routes
router.get("/bills/search", inventoryTransactionController.searchBills);
router.post("/bills/return", inventoryTransactionController.returnBillItems);
router.get("/bills/:saleId", inventoryTransactionController.getBillDetails);

// Transaction creation endpoints
router.post("/stock-transactions", stockTransactionValidation, inventoryTransactionController.createStockTransaction);
router.post("/sale-transactions", saleTransactionValidation, inventoryTransactionController.createSaleTransaction);

module.exports = router;
