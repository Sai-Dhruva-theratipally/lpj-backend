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

module.exports = {
  createSaleTransaction,
  createStockTransaction,
  lookupInventory,
};
