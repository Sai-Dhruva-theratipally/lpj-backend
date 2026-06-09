const asyncHandler = require("../middleware/asyncHandler");
const inventoryTransactionService = require("../services/inventoryTransactionService");
const { sendSuccess } = require("../utils/apiResponse");

const createStockTransaction = asyncHandler(async (req, res) => {
  const transaction = await inventoryTransactionService.createStockTransaction(req.body);
  return sendSuccess(res, 201, "Stock transaction saved successfully", transaction);
});

const createSaleTransaction = asyncHandler(async (req, res) => {
  const sale = await inventoryTransactionService.createSaleTransaction(req.body);
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

const getBillDetails = asyncHandler(async (req, res) => {
  const bill = await inventoryTransactionService.getBillDetails(req.params.saleId);
  return sendSuccess(res, 200, "Bill details fetched successfully", bill);
});

const returnBillItems = asyncHandler(async (req, res) => {
  const result = await inventoryTransactionService.returnBillItems(req.body);
  return sendSuccess(res, 200, "Items returned successfully", result);
});

module.exports = {
  createSaleTransaction,
  createStockTransaction,
  getBillDetails,
  getSuggestions,
  lookupInventory,
  returnBillItems,
  searchBills,
};
