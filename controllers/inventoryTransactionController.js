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

module.exports = {
  createSaleTransaction,
  createStockTransaction,
  lookupInventory,
  getSuggestions,
};
