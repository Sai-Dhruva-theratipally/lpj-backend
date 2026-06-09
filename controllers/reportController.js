const asyncHandler = require("../middleware/asyncHandler");
const pdfService = require("../services/pdfService");
const reportService = require("../services/reportService");
const { sendSuccess } = require("../utils/apiResponse");

const getStockReport = asyncHandler(async (req, res) => {
  const report = await reportService.getStockReport(req.query);
  return sendSuccess(res, 200, "Stock report generated successfully", report);
});

const getSalesReport = asyncHandler(async (req, res) => {
  const report = await reportService.getSalesReport(req.query);
  return sendSuccess(res, 200, "Sales report generated successfully", report);
});

const getSalesInwardReport = asyncHandler(async (req, res) => {
  const report = await reportService.getStockInwardReport(req.query);
  return sendSuccess(res, 200, "Sales inward report generated successfully", report);
});

const getInventoryReport = asyncHandler(async (req, res) => {
  const report = await reportService.getInventoryReport(req.query);
  return sendSuccess(res, 200, "Inventory report generated successfully", report);
});

const getCustomerLookups = asyncHandler(async (req, res) => {
  const customers = await reportService.getCustomerLookups(req.query);
  return sendSuccess(res, 200, "Customers fetched successfully", customers);
});

const downloadStockReportPdf = asyncHandler(async (req, res) => {
  const report = await reportService.getStockReport(req.query);
  return pdfService.streamReportPdf(res, report);
});

const downloadSalesReportPdf = asyncHandler(async (req, res) => {
  const report = await reportService.getSalesReport(req.query);
  return pdfService.streamReportPdf(res, report);
});

const downloadSalesInwardReportPdf = asyncHandler(async (req, res) => {
  const report = await reportService.getStockInwardReport(req.query);
  return pdfService.streamReportPdf(res, report);
});

const downloadInventoryReportPdf = asyncHandler(async (req, res) => {
  const report = await reportService.getInventoryReport(req.query);
  return pdfService.streamReportPdf(res, report);
});

module.exports = {
  downloadInventoryReportPdf,
  downloadSalesInwardReportPdf,
  downloadSalesReportPdf,
  downloadStockReportPdf,
  getCustomerLookups,
  getInventoryReport,
  getSalesInwardReport,
  getSalesReport,
  getStockReport,
};
