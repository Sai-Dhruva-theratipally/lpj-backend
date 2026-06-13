const asyncHandler = require("../middleware/asyncHandler");
const categoryService = require("../services/categoryService");
const { sendSuccess } = require("../utils/apiResponse");

const getCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.getCategories(req.query);
  return sendSuccess(res, 200, "Categories fetched successfully", categories);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.findOrCreateCategory(
    req.body.name,
    req.body.stockType,
    req.body.metalType,
    req.body.categoryCode
  );
  return sendSuccess(res, 201, "Category saved successfully", category);
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  return sendSuccess(res, 200, "Category updated successfully", category);
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.deleteCategory(req.params.id);
  return sendSuccess(res, 200, "Category deleted successfully", category);
});

module.exports = { createCategory, getCategories, updateCategory, deleteCategory };
