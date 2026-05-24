const express = require("express");
const { resetDatabase, resetStock, changePassword } = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");
const { resetDatabaseValidation, resetStockValidation, changePasswordValidation } = require("../validations/adminValidation");

const router = express.Router();

router.post("/reset-database", protect, resetDatabaseValidation, resetDatabase);
router.post("/reset-stock", protect, resetStockValidation, resetStock);
router.post("/change-password", protect, changePasswordValidation, changePassword);

module.exports = router;
