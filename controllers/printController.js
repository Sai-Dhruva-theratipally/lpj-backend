const asyncHandler = require("../middleware/asyncHandler");
const printerService = require("../services/printerService");
const { sendSuccess } = require("../utils/apiResponse");

const generateTagZpl = asyncHandler(async (req, res) => {
  const printJob = await printerService.generateTagPrint(req.body);
  return sendSuccess(res, 200, "Tag ZPL generated successfully", printJob);
});

const generateTrayZpl = asyncHandler(async (req, res) => {
  const printJob = await printerService.generateTrayPrint(req.body);
  return sendSuccess(res, 200, "Tray ZPL generated successfully", printJob);
});

const generateBatchZpl = asyncHandler(async (req, res) => {
  const printJob = await printerService.generateBatchPrint(req.body);
  return sendSuccess(res, 200, "Batch ZPL generated successfully", printJob);
});

const generateManualTextTagZpl = asyncHandler(async (req, res) => {
  const printJob = await printerService.generateManualTextTagPrint(req.body);
  return sendSuccess(res, 200, "Manual tag ZPL generated successfully", printJob);
});

module.exports = {
  generateBatchZpl,
  generateManualTextTagZpl,
  generateTagZpl,
  generateTrayZpl,
};
