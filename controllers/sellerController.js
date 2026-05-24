const asyncHandler = require("../middleware/asyncHandler");
const sellerService = require("../services/sellerService");
const { sendSuccess } = require("../utils/apiResponse");

const getSellers = asyncHandler(async (req, res) => {
  const sellers = await sellerService.getSellers(req.query);
  return sendSuccess(res, 200, "Sellers fetched successfully", sellers);
});

const createSeller = asyncHandler(async (req, res) => {
  const seller = await sellerService.findOrCreateSeller(req.body.name);
  return sendSuccess(res, 201, "Seller saved successfully", seller);
});

module.exports = { createSeller, getSellers };
