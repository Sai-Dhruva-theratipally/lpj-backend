const asyncHandler = require("../middleware/asyncHandler");
const aiSaleImportService = require("../services/aiSaleImportService");
const { sendSuccess } = require("../utils/apiResponse");

const extractSaleImport = asyncHandler(async (req, res) => {
  const result = await aiSaleImportService.extractSaleRowsFromImages(req.files || []);
  return sendSuccess(res, 200, "Sale sheet extracted successfully", result);
});

module.exports = {
  extractSaleImport,
};
