const asyncHandler = require("../middleware/asyncHandler");
const tagInventoryService = require("../services/tagInventoryService");
const { sendSuccess } = require("../utils/apiResponse");

const addTagStock = asyncHandler(async (req, res) => {
  const tag = await tagInventoryService.createTag(req.body);
  return sendSuccess(res, 201, "Tag stock added successfully", tag);
});

const getTagStock = asyncHandler(async (req, res) => {
  const tags = await tagInventoryService.getTags(req.query);
  return sendSuccess(res, 200, "Tag stock fetched successfully", tags);
});

const getTagStockById = asyncHandler(async (req, res) => {
  const tag = await tagInventoryService.getTagById(req.params.id);
  return sendSuccess(res, 200, "Tag stock fetched successfully", tag);
});

const updateTagStock = asyncHandler(async (req, res) => {
  const tag = await tagInventoryService.updateTag(req.params.id, req.body);
  return sendSuccess(res, 200, "Tag stock updated successfully", tag);
});

const sellTagStock = asyncHandler(async (req, res) => {
  const result = await tagInventoryService.sellTag(req.params.id, req.body);
  return sendSuccess(res, 200, "Tag sold successfully", result);
});

const cancelTagSale = asyncHandler(async (req, res) => {
  const result = await tagInventoryService.cancelTagSale(req.params.id, req.body);
  return sendSuccess(res, 200, "Tag sale cancelled successfully", result);
});

const deleteTagStock = asyncHandler(async (req, res) => {
  const tag = await tagInventoryService.deleteTag(req.params.id);
  return sendSuccess(res, 200, "Tag stock deleted successfully", tag);
});

const updateTagPrintStatus = asyncHandler(async (req, res) => {
  const result = await tagInventoryService.updatePrintStatus(req.body.ids, req.body.status || "PRINTED");
  return sendSuccess(res, 200, "Tag print status updated successfully", result);
});

module.exports = {
  addTagStock,
  cancelTagSale,
  deleteTagStock,
  getTagStock,
  getTagStockById,
  sellTagStock,
  updateTagPrintStatus,
  updateTagStock,
};
