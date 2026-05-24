const asyncHandler = require("../middleware/asyncHandler");
const adminService = require("../services/adminService");
const { sendSuccess } = require("../utils/apiResponse");

const resetDatabase = asyncHandler(async (req, res) => {
  const result = await adminService.resetDatabase(req.admin._id, req.body.password);
  return sendSuccess(res, 200, "Database reset successfully", result);
});

const resetStock = asyncHandler(async (req, res) => {
  const result = await adminService.resetStock(req.admin._id, req.body.password, req.body.stockType);
  return sendSuccess(res, 200, "Stock reset successfully", result);
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await adminService.changePassword(req.admin._id, req.body.currentPassword, req.body.newPassword);
  return sendSuccess(res, 200, "Password changed successfully", result);
});

module.exports = { resetDatabase, resetStock, changePassword };
