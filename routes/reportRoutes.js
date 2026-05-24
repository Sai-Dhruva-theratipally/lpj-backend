const express = require("express");
const reportController = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");
const {
  inventoryReportValidation,
  salesReportValidation,
  stockReportValidation,
} = require("../validations/reportValidation");

const router = express.Router();

router.use(protect);

router.get("/lookups/customers", reportController.getCustomerLookups);

router.get("/stock", stockReportValidation, reportController.getStockReport);
router.get("/sales", salesReportValidation, reportController.getSalesReport);
router.get("/inventory", inventoryReportValidation, reportController.getInventoryReport);

router.get("/stock/pdf", stockReportValidation, reportController.downloadStockReportPdf);
router.get("/sales/pdf", salesReportValidation, reportController.downloadSalesReportPdf);
router.get("/inventory/pdf", inventoryReportValidation, reportController.downloadInventoryReportPdf);

module.exports = router;
