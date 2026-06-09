const express = require("express");
const reportController = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");
const {
  inventoryReportValidation,
  salesInwardReportValidation,
  salesReportValidation,
  stockReportValidation,
} = require("../validations/reportValidation");

const router = express.Router();

router.use(protect);

router.get("/lookups/customers", reportController.getCustomerLookups);

router.get("/stock", stockReportValidation, reportController.getStockReport);
router.get("/sales", salesReportValidation, reportController.getSalesReport);
router.get("/sales-inward", salesInwardReportValidation, reportController.getSalesInwardReport);
router.get("/inventory", inventoryReportValidation, reportController.getInventoryReport);

router.get("/stock/pdf", stockReportValidation, reportController.downloadStockReportPdf);
router.get("/sales/pdf", salesReportValidation, reportController.downloadSalesReportPdf);
router.get("/sales-inward/pdf", salesInwardReportValidation, reportController.downloadSalesInwardReportPdf);
router.get("/inventory/pdf", inventoryReportValidation, reportController.downloadInventoryReportPdf);

module.exports = router;
