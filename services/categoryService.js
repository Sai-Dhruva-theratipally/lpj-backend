const Category = require("../models/Category");

const normalizeToUppercase = (value) => value.trim().toUpperCase();
const normalizeMetalType = (metalType) => metalType.trim().toUpperCase();

const getCategories = async (query = {}) => {
  const filters = {};
  const andFilters = [];

  if (query.search) {
    const searchUpper = normalizeToUppercase(query.search);
    andFilters.push({
      $or: [
        { name: new RegExp(searchUpper) },
        { categoryCode: new RegExp(searchUpper) },
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
  const normalizedInput = normalizeToUppercase(input);
  const normalizedMetalType = normalizeMetalType(metalType);
  const filters = {
    metalType: normalizedMetalType,
    $or: [
      { name: normalizedInput },
      { categoryCode: normalizedInput },
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
  const normalizedName = normalizeToUppercase(name);
  const normalizedMetalType = normalizeMetalType(metalType);
  const normalizedCode = categoryCode ? normalizeToUppercase(categoryCode) : undefined;

  const category = await Category.findOne({ metalType: normalizedMetalType, name: normalizedName });

  if (category) {
    if (stockType && !category.stockTypes.includes(stockType)) {
      category.stockTypes.push(stockType);
      await category.save();
    }

    return category;
  }

  if (!normalizedCode) {
    const error = new Error("Category code is required for new category");
    error.statusCode = 400;
    throw error;
  }

  const duplicateCode = await Category.findOne({ categoryCode: normalizedCode });

  if (duplicateCode) {
    const error = new Error("Category code already exists");
    error.statusCode = 409;
    throw error;
  }

  return Category.create({
    name: normalizedName,
    categoryCode: normalizedCode,
    metalType: normalizedMetalType,
    stockTypes: stockType ? [stockType] : [],
  });
};

module.exports = {
  findCategoryByNameOrCode,
  findOrCreateCategory,
  getCategories,
};
