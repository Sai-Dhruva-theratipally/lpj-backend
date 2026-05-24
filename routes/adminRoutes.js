const express = require("express");
const { resetDatabase, resetStock } = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { resetDatabaseValidation, resetStockValidation } = require("../validations/adminValidation");

const router = express.Router();

router.post("/reset-database", protect, resetDatabaseValidation, resetDatabase);
router.post("/reset-stock", protect, resetStockValidation, resetStock);

module.exports = router;
