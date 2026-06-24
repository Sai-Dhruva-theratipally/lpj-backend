const asyncHandler = require("../middleware/asyncHandler");
const manualRateService = require("../services/manualRateService");
const { sendSuccess } = require("../utils/apiResponse");

const getLatestRates = asyncHandler(async (req, res) => {
  const rates = await manualRateService.getLatestRates();
  return sendSuccess(res, 200, "Latest rates fetched successfully", rates);
});

const getRateHistory = asyncHandler(async (req, res) => {
  const history = await manualRateService.getRateHistory(req.query);
  return sendSuccess(res, 200, "Rate history fetched successfully", history);
});

const recordRate = asyncHandler(async (req, res) => {
  const { metalType, rateType, rate } = req.body;

  if (!metalType || !rateType || rate === undefined) {
    const error = new Error("metalType, rateType, and rate are required");
    error.statusCode = 400;
    throw error;
  }

  const recorded = await manualRateService.recordRate(metalType, rateType, rate, {
    recordedBy: req.user?.username || "ADMIN",
  });

  if (!recorded) {
    const error = new Error("Invalid rate value");
    error.statusCode = 400;
    throw error;
  }

  return sendSuccess(res, 201, "Rate recorded successfully", recorded);
});

module.exports = { getLatestRates, getRateHistory, recordRate };
