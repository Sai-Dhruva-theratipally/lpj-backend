const Category = require("../models/Category");
const Inventory = require("../models/Inventory");

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

const updateCategory = async (id, updateData) => {
  const category = await Category.findById(id);
  
  if (!category) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }

  if (updateData.name) {
    const normalizedName = normalizeToUppercase(updateData.name);
    const existing = await Category.findOne({ 
      _id: { $ne: id }, 
      metalType: category.metalType, 
      name: normalizedName 
    });
    
    if (existing) {
      const error = new Error("Category name already exists for this metal type");
      error.statusCode = 409;
      throw error;
    }
    
    category.name = normalizedName;
  }

  return category.save();
};

const deleteCategory = async (id) => {
  const category = await Category.findById(id);
  
  if (!category) {
    const error = new Error("Category not found");
    error.statusCode = 404;
    throw error;
  }

  // Delete all inventory items associated with this category
  const deleteResult = await Inventory.deleteMany({
    category: category.name,
  });

  // Delete the category
  await Category.findByIdAndDelete(id);
  
  return {
    category,
    deletedInventoryCount: deleteResult.deletedCount,
  };
};

module.exports = {
  findCategoryByNameOrCode,
  findOrCreateCategory,
  getCategories,
  updateCategory,
  deleteCategory,
};
