const asyncHandler = require("../middleware/asyncHandler");
const { parseBulkSaleJson } = require("../services/bulkSaleJsonParserService");
const aiSaleImageImportService = require("../services/aiSaleImageImportService");
const bulkSaleService = require("../services/bulkSaleService");
const { validateBulkSaleRows } = require("../services/bulkSaleValidationService");
const inventoryTransactionService = require("../services/inventoryTransactionService");
const manualRateService = require("../services/manualRateService");
const { sendSuccess } = require("../utils/apiResponse");

const createStockTransaction = asyncHandler(async (req, res) => {
  const transaction = await inventoryTransactionService.createStockTransaction(req.body);
  
  // Save rates used in this transaction
  if (transaction._id) {
    await manualRateService.saveTransactionRates(transaction._id, "StockTransaction", transaction.rates || {});
  }
  
  return sendSuccess(res, 201, "Stock transaction saved successfully", transaction);
});

const createSaleTransaction = asyncHandler(async (req, res) => {
  const sale = await inventoryTransactionService.createSaleTransaction(req.body);
  
  // Save rates used in this transaction
  if (sale._id) {
    await manualRateService.saveTransactionRates(sale._id, "SaleTransaction", sale.rates || {});
  }
  
  return sendSuccess(res, 201, "Sale transaction saved successfully", sale);
});

const lookupInventory = asyncHandler(async (req, res) => {
  const inventory = await inventoryTransactionService.getInventoryLookup(req.params.identifier);
  return sendSuccess(res, 200, "Inventory item fetched successfully", inventory);
});

const getSuggestions = asyncHandler(async (req, res) => {
  const { search, limit } = req.query;
  const suggestions = await inventoryTransactionService.getSuggestions(search, parseInt(limit) || 10);
  return sendSuccess(res, 200, "Suggestions fetched successfully", suggestions);
});

const searchBills = asyncHandler(async (req, res) => {
  const bills = await inventoryTransactionService.searchBills(req.query);
  return sendSuccess(res, 200, "Bills fetched successfully", bills);
});

const getSoldItems = asyncHandler(async (req, res) => {
  const items = await inventoryTransactionService.getSoldItems(req.query);
  return sendSuccess(res, 200, "Sold items fetched successfully", items);
});

const getBillDetails = asyncHandler(async (req, res) => {
  const bill = await inventoryTransactionService.getBillDetails(req.params.saleId);
  return sendSuccess(res, 200, "Bill details fetched successfully", bill);
});

const returnBillItems = asyncHandler(async (req, res) => {
  const result = await inventoryTransactionService.returnBillItems(req.body);
  return sendSuccess(res, 200, "Items returned successfully", result);
});

const parseBulkSaleJsonText = asyncHandler(async (req, res) => {
  const rows = parseBulkSaleJson(req.body.jsonText);
  return sendSuccess(res, 200, "Bulk sale JSON parsed successfully", { rows });
});

const extractBulkSaleImage = asyncHandler(async (req, res) => {
  const extraction = await aiSaleImageImportService.extractSaleRowsFromImages(req.files || []);
  const validation = await validateBulkSaleRows(extraction.rows);

  return sendSuccess(res, 200, "Sale list image extracted successfully", {
    ...extraction,
    ...validation,
  });
});

const validateBulkSaleImport = asyncHandler(async (req, res) => {
  const result = await validateBulkSaleRows(req.body.rows || []);
  return sendSuccess(res, 200, "Bulk sale rows validated successfully", result);
});

const previewBulkSaleImport = asyncHandler(async (req, res) => {
  const validation = await validateBulkSaleRows(req.body.rows || []);
  if (!validation.isValid) {
    return sendSuccess(res, 200, "Bulk sale rows contain validation errors", validation);
  }

  const result = await bulkSaleService.getBulkSalePreview(validation.rows);
  return sendSuccess(res, 200, "Bulk sale preview generated successfully", result);
});

const createBulkSaleImport = asyncHandler(async (req, res) => {
  const result = await bulkSaleService.createBulkSales(req.body.rows || []);
  return sendSuccess(res, 201, "Bulk sales created successfully", result);
});

module.exports = {
  createBulkSaleImport,
  createSaleTransaction,
  createStockTransaction,
  extractBulkSaleImage,
  getBillDetails,
  getSuggestions,
  lookupInventory,
  parseBulkSaleJsonText,
  previewBulkSaleImport,
  getSoldItems,
  returnBillItems,
  validateBulkSaleImport,
  searchBills,
};
