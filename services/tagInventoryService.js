const Inventory = require("../models/Inventory");
const Sale = require("../models/Sale");
const categoryService = require("./categoryService");
const sellerService = require("./sellerService");
const { getNextTagCode } = require("../utils/tagCode");

const normalizeSearchRegex = (value) => new RegExp(String(value).trim(), "i");
const normalizeDecimal = (value, fallback = 0) => {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Number(number.toFixed(3)) : fallback;
};

const buildTagFilters = (query) => {
  const filters = {
    stockType: "TAG",
    isDeleted: false,
  };

  if (query.status) {
    filters.status = query.status;
  }

  if (query.category) {
    filters.category = normalizeSearchRegex(query.category);
  }

  if (query.metalType) {
    filters.metalType = query.metalType;
  }

  if (query.sellerName || query.seller) {
    filters.sellerName = normalizeSearchRegex(query.sellerName || query.seller);
  }

  if (query.date) {
    const start = new Date(query.date);
    const end = new Date(query.date);
    end.setDate(end.getDate() + 1);
    filters.purchaseDate = { $gte: start, $lt: end };
  }

  if (query.search) {
    const search = String(query.search).trim();
    const searchFilters = [
      { category: normalizeSearchRegex(search) },
      { sellerName: normalizeSearchRegex(search) },
    ];

    if (!Number.isNaN(Number(search))) {
      searchFilters.push({ tagId: Number(search) });
    }

    filters.$or = searchFilters;
  }

  return filters;
};

const getTags = async (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const skip = (page - 1) * limit;
  const filters = buildTagFilters(query);

  const [items, total] = await Promise.all([
    Inventory.find(filters).sort({ tagId: -1 }).skip(skip).limit(limit),
    Inventory.countDocuments(filters),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getTagById = async (id) => {
  const numericId = Number(id);
  const query = Number.isNaN(numericId) ? { _id: id } : { tagId: numericId };

  const tag = await Inventory.findOne({
    ...query,
    stockType: "TAG",
    isDeleted: false,
  });

  if (!tag) {
    const error = new Error("Tag not found");
    error.statusCode = 404;
    throw error;
  }

  return tag;
};

const createTag = async (payload) => {
  const [existingCategory, seller] = await Promise.all([
    categoryService.findCategoryByNameOrCode({
      input: payload.categoryInput || payload.category || payload.categoryCode,
      stockType: "TAG",
      metalType: payload.metalType,
    }),
    sellerService.findOrCreateSeller(payload.sellerName),
  ]);
  const category =
    existingCategory ||
    (await categoryService.findOrCreateCategory(payload.category, "TAG", payload.metalType, payload.categoryCode));

  const tagId = await getNextTagCode();

  return Inventory.create({
    stockType: "TAG",
    tagId,
    category: category.name,
    categoryCode: category.categoryCode,
    metalType: category.metalType,
    pieces: payload.pieces ?? 1,
    weight: normalizeDecimal(payload.weight),
    grossWeight: normalizeDecimal(payload.weight),
    stoneWeight: normalizeDecimal(payload.stoneWeight),
    seller: seller._id,
    sellerName: seller.name,
    purchaseDate: new Date(payload.date || payload.purchaseDate),
    status: "AVAILABLE",
    isDeleted: false,
  });
};

const updateTag = async (id, payload) => {
  const tag = await getTagById(id);

  if (tag.status === "SOLD") {
    const error = new Error("Sold tag stock cannot be edited until the sale is cancelled");
    error.statusCode = 400;
    throw error;
  }

  if (payload.category !== undefined) {
    const category = await categoryService.findCategoryByNameOrCode({
      input: payload.category,
      stockType: "TAG",
      metalType: payload.metalType || tag.metalType,
    });
    if (!category) {
      const error = new Error("Category not found");
      error.statusCode = 404;
      throw error;
    }
    tag.category = category.name;
    tag.categoryCode = category.categoryCode;
    tag.metalType = category.metalType;
  }

  if (payload.sellerName !== undefined) {
    const seller = await sellerService.findOrCreateSeller(payload.sellerName);
    tag.seller = seller._id;
    tag.sellerName = seller.name;
  }

  if (payload.weight !== undefined) {
    tag.weight = normalizeDecimal(payload.weight);
    tag.grossWeight = tag.weight;
  }

  if (payload.stoneWeight !== undefined) {
    tag.stoneWeight = normalizeDecimal(payload.stoneWeight);
  }

  if (payload.date !== undefined || payload.purchaseDate !== undefined) {
    tag.purchaseDate = new Date(payload.date || payload.purchaseDate);
  }

  return tag.save();
};

const sellTag = async (id, payload = {}) => {
  const tag = await getTagById(id);

  if (tag.status === "SOLD") {
    const error = new Error("Tag is already sold");
    error.statusCode = 400;
    throw error;
  }

  tag.status = "SOLD";
  await tag.save();

  const sale = await Sale.create({
    inventory: tag._id,
    stockType: "TAG",
    tagId: tag.tagId,
    saleDate: payload.saleDate ? new Date(payload.saleDate) : new Date(),
    history: [{ action: "SOLD", note: payload.note || "" }],
  });

  return { tag, sale };
};

const cancelTagSale = async (id, payload = {}) => {
  const tag = await getTagById(id);

  if (tag.status !== "SOLD") {
    const error = new Error("Only sold tags can be returned to stock");
    error.statusCode = 400;
    throw error;
  }

  const sale = await Sale.findOne({
    inventory: tag._id,
    stockType: "TAG",
    status: "ACTIVE",
  }).sort({ createdAt: -1 });

  if (!sale) {
    const error = new Error("Active sale record not found for this tag");
    error.statusCode = 404;
    throw error;
  }

  sale.status = "CANCELLED";
  sale.cancelledAt = new Date();
  sale.cancelReason = payload.reason || "";
  sale.history.push({ action: "CANCELLED", note: payload.reason || "" });
  tag.status = "AVAILABLE";

  const [updatedTag, updatedSale] = await Promise.all([tag.save(), sale.save()]);

  return { tag: updatedTag, sale: updatedSale };
};

const deleteTag = async (id) => {
  const tag = await getTagById(id);

  if (tag.status === "SOLD") {
    const error = new Error("Sold tag stock cannot be deleted");
    error.statusCode = 400;
    throw error;
  }

  tag.isDeleted = true;
  tag.status = "ARCHIVED";

  return tag.save();
};

module.exports = {
  cancelTagSale,
  createTag,
  deleteTag,
  getTagById,
  getTags,
  sellTag,
  updateTag,
};
