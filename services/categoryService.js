const Category = require("../models/Category");

const normalizeCategoryKey = (name) => name.trim().toLowerCase();
const normalizeCode = (code) => code.trim().toUpperCase();
const normalizeMetalType = (metalType) => metalType.trim().toUpperCase();

const getCategories = async (query = {}) => {
  const filters = {};
  const andFilters = [];

  if (query.search) {
    andFilters.push({
      $or: [
        { name: new RegExp(query.search, "i") },
        { categoryCode: new RegExp(query.search, "i") },
      ],
    });
  }

  if (query.stockType) {
    andFilters.push({
      $or: [{ stockTypes: query.stockType }, { stockTypes: { $size: 0 } }],
    });
  }

  if (query.metalType) {
    filters.metalType = normalizeMetalType(query.metalType);
  }

  if (andFilters.length > 0) {
    filters.$and = andFilters;
  }

  return Category.find(filters).sort({ metalType: 1, name: 1 });
};

const findCategoryByNameOrCode = async ({ input, stockType, metalType }) => {
  const trimmedInput = input.trim();
  const normalizedMetalType = normalizeMetalType(metalType);
  const filters = {
    metalType: normalizedMetalType,
    $or: [
      { nameKey: normalizeCategoryKey(trimmedInput) },
      { categoryCodeKey: normalizeCode(trimmedInput) },
    ],
  };

  if (stockType) {
    filters.$and = [
      {
        $or: [{ stockTypes: stockType }, { stockTypes: { $size: 0 } }],
      },
    ];
  }

  return Category.findOne(filters);
};

const findOrCreateCategory = async (name, stockType, metalType, categoryCode) => {
  const trimmedName = name.trim();
  const normalizedMetalType = normalizeMetalType(metalType);
  const nameKey = normalizeCategoryKey(trimmedName);
  const categoryCodeKey = categoryCode ? normalizeCode(categoryCode) : undefined;

  const category = await Category.findOne({ metalType: normalizedMetalType, nameKey });

  if (category) {
    if (stockType && !category.stockTypes.includes(stockType)) {
      category.stockTypes.push(stockType);
      await category.save();
    }

    return category;
  }

  if (!categoryCodeKey) {
    const error = new Error("Category code is required for new category");
    error.statusCode = 400;
    throw error;
  }

  const duplicateCode = await Category.findOne({ categoryCodeKey });

  if (duplicateCode) {
    const error = new Error("Category code already exists");
    error.statusCode = 409;
    throw error;
  }

  return Category.create({
    name: trimmedName,
    nameKey,
    categoryCode: categoryCodeKey,
    categoryCodeKey,
    metalType: normalizedMetalType,
    stockTypes: stockType ? [stockType] : [],
  });
};

module.exports = {
  findCategoryByNameOrCode,
  findOrCreateCategory,
  getCategories,
};
