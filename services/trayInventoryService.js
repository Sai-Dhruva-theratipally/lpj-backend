const Inventory = require("../models/Inventory");
const categoryService = require("./categoryService");
const sellerService = require("./sellerService");

const normalizeToUppercase = (value) => value.trim().toUpperCase();
const normalizeDecimal = (value, fallback = 0) => {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Number(number.toFixed(3)) : fallback;
};

const buildTrayFilters = (query) => {
  const filters = {
    stockType: "TRAY",
  };

  if (query.status) {
    filters.status = query.status;
  }

  if (query.category) {
    filters.category = new RegExp(normalizeToUppercase(query.category));
  }

  if (query.metalType) {
    filters.metalType = new RegExp(normalizeToUppercase(query.metalType));
  }

  if (query.trayCode) {
    filters.trayCode = normalizeToUppercase(query.trayCode);
  }

  if (query.trayName) {
    filters.trayName = normalizeToUppercase(query.trayName);
  }

  if (query.search) {
    const searchUpper = normalizeToUppercase(query.search);
    filters.$or = [
      { trayCode: new RegExp(searchUpper) },
      { trayName: new RegExp(searchUpper) },
      { category: new RegExp(searchUpper) },
      { metalType: new RegExp(searchUpper) },
    ];
  }

  return filters;
};

const calculateAverageWeight = (quantity, totalWeight) => {
  return quantity > 0 ? Number((totalWeight / quantity).toFixed(3)) : 0;
};

const createTray = async (payload) => {
  const trayName = normalizeToUppercase(payload.trayName || payload.name);
  const trayCode = payload.trayCode ? normalizeToUppercase(payload.trayCode) : undefined;

  const duplicateChecks = [{ trayName }];

  if (trayCode) {
    duplicateChecks.push({ trayCode });
  }

  const existingTray = await Inventory.findOne({
    stockType: "TRAY",
    $or: duplicateChecks,
  });

  if (existingTray) {
    const error = new Error(existingTray.trayCode === trayCode ? "Tray id already exists" : "Tray name already exists");
    error.statusCode = 409;
    throw error;
  }

  const category = payload.category
    ? await categoryService.findCategoryByNameOrCode({
        input: payload.category,
        stockType: "TRAY",
        metalType: payload.metalType,
      })
    : null;

  return Inventory.create({
    stockType: "TRAY",
    trayCode,
    trayName,
    category: category?.name || normalizeToUppercase(payload.category || ""),
    categoryCode: category?.categoryCode || payload.categoryCode,
    metalType: payload.metalType,
    quantity: payload.quantity ?? 0,
    totalWeight: normalizeDecimal(payload.totalWeight),
    grossWeight: normalizeDecimal(payload.totalWeight),
    stoneWeight: normalizeDecimal(payload.stoneWeight),
    purity: payload.purity,
    description: normalizeToUppercase(payload.description || payload.desc || ""),
    status: payload.status || "AVAILABLE",
  });
};

const createMultipleTrays = async (items) => {
  const results = [];

  for (const item of items) {
    try {
      const tray = await createTray(item);
      results.push({ success: true, data: tray });
    } catch (error) {
      results.push({
        success: false,
        trayName: item.trayName || item.name,
        message: error.message,
      });
    }
  }

  return {
    created: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    results,
  };
};

const getTrays = async (query) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;
  const filters = buildTrayFilters(query);

  const [items, total] = await Promise.all([
    Inventory.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit),
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

const getTrayById = async (id) => {
  const tray = await Inventory.findOne({ _id: id, stockType: "TRAY" });

  if (!tray) {
    const error = new Error("Tray not found");
    error.statusCode = 404;
    throw error;
  }

  return tray;
};

const getTrayForStockChange = async (payload) => {
  if (payload.id || payload.trayId) {
    return getTrayById(payload.id || payload.trayId);
  }

  const identifier = payload.identifier || payload.trayCode || payload.code || payload.trayName || payload.name;

  if (identifier) {
    const normalizedIdentifier = normalizeToUppercase(identifier);
    const isMongoId = /^[a-f\d]{24}$/i.test(normalizedIdentifier);
    const tray = isMongoId
      ? await Inventory.findOne({ _id: normalizedIdentifier, stockType: "TRAY" })
      : await Inventory.findOne({
          stockType: "TRAY",
          $or: [
            { trayCode: normalizedIdentifier },
            { trayName: normalizedIdentifier },
          ],
        });

    if (!tray) {
      const error = new Error("Tray not found");
      error.statusCode = 404;
      throw error;
    }

    return tray;
  }

  if (payload.trayName || payload.name) {
    const tray = await Inventory.findOne({
      stockType: "TRAY",
      trayName: normalizeToUppercase(payload.trayName || payload.name),
    });

    if (!tray) {
      const error = new Error("Tray not found");
      error.statusCode = 404;
      throw error;
    }

    return tray;
  }

  const error = new Error("Tray id or tray name is required");
  error.statusCode = 400;
  throw error;
};

const updateTray = async (id, payload) => {
  const tray = await getTrayById(id);

  if (payload.trayName || payload.name) {
    const trayName = normalizeToUppercase(payload.trayName || payload.name);
    const existingTray = await Inventory.findOne({
      _id: { $ne: tray._id },
      stockType: "TRAY",
      trayName,
    });

    if (existingTray) {
      const error = new Error("Tray name already exists");
      error.statusCode = 409;
      throw error;
    }

    tray.trayName = trayName;
  }

  const editableFields = ["category", "metalType", "purity", "status", "description"];

  for (const field of editableFields) {
    if (payload[field] !== undefined) {
      if (field === "category") {
        const category = await categoryService.findCategoryByNameOrCode({
          input: payload[field],
          stockType: "TRAY",
          metalType: payload.metalType || tray.metalType,
        });
        if (!category) {
          const error = new Error("Category not found");
          error.statusCode = 404;
          throw error;
        }
        tray[field] = category.name;
        tray.categoryCode = category.categoryCode;
        tray.metalType = category.metalType;
      } else if (field === "description") {
        tray[field] = normalizeToUppercase(payload[field]);
      } else {
        tray[field] = payload[field];
      }
    }
  }

  if (payload.quantity !== undefined) {
    tray.quantity = payload.quantity;
  }

  if (payload.totalWeight !== undefined) {
    tray.totalWeight = normalizeDecimal(payload.totalWeight);
    tray.grossWeight = tray.totalWeight;
  }

  if (payload.stoneWeight !== undefined) {
    tray.stoneWeight = normalizeDecimal(payload.stoneWeight);
  }

  tray.averageWeight = calculateAverageWeight(tray.quantity, tray.totalWeight);

  return tray.save();
};

const applyTrayStockAddition = async (tray, payload) => {
  const seller = await sellerService.findOrCreateSeller(payload.sellerName);
  const purchaseDate = payload.purchaseDate ? new Date(payload.purchaseDate) : new Date();

  tray.quantity += Number(payload.quantity);
  tray.totalWeight = Number((tray.totalWeight + normalizeDecimal(payload.totalWeight)).toFixed(3));
  tray.grossWeight = tray.totalWeight;
  tray.stoneWeight = Number(((tray.stoneWeight || 0) + normalizeDecimal(payload.stoneWeight)).toFixed(3));
  tray.averageWeight = calculateAverageWeight(tray.quantity, tray.totalWeight);
  tray.stockEntries.push({
    seller: seller._id,
    sellerName: seller.name,
    quantity: Number(payload.quantity),
    totalWeight: normalizeDecimal(payload.totalWeight),
    stoneWeight: normalizeDecimal(payload.stoneWeight),
    purchaseDate,
  });

  return tray.save();
};

const applyTrayStockReduction = async (tray, payload) => {
  if (Number(payload.quantity) > tray.quantity) {
    const error = new Error("Cannot sell more quantity than available in tray");
    error.statusCode = 400;
    throw error;
  }

  if (Number(payload.totalWeight) > tray.totalWeight) {
    const error = new Error("Cannot sell more weight than available in tray");
    error.statusCode = 400;
    throw error;
  }

  if (normalizeDecimal(payload.stoneWeight) > (tray.stoneWeight || 0)) {
    const error = new Error("Cannot sell more stone weight than available in tray");
    error.statusCode = 400;
    throw error;
  }

  tray.quantity -= Number(payload.quantity);
  tray.totalWeight = Number((tray.totalWeight - normalizeDecimal(payload.totalWeight)).toFixed(3));
  tray.grossWeight = tray.totalWeight;
  tray.stoneWeight = Number(((tray.stoneWeight || 0) - normalizeDecimal(payload.stoneWeight)).toFixed(3));
  tray.averageWeight = calculateAverageWeight(tray.quantity, tray.totalWeight);

  return tray.save();
};

const addTrayStock = async (id, payload) => {
  const tray = await getTrayById(id);
  return applyTrayStockAddition(tray, payload);
};

const addTrayStockByIdentifier = async (payload) => {
  const tray = await getTrayForStockChange(payload);
  return applyTrayStockAddition(tray, payload);
};

const reduceTrayStock = async (id, payload) => {
  const tray = await getTrayById(id);
  return applyTrayStockReduction(tray, payload);
};

const sellFromTray = async (id, payload) => {
  const tray = await getTrayById(id);
  return applyTrayStockReduction(tray, payload);
};

const sellMultipleFromTrays = async (items) => {
  const results = [];

  for (const item of items) {
    try {
      const tray = await getTrayForStockChange(item);
      const updatedTray = await applyTrayStockReduction(tray, item);
      results.push({
        success: true,
        data: updatedTray,
        sold: {
          trayId: updatedTray._id,
          trayCode: updatedTray.trayCode,
          trayName: updatedTray.trayName,
          quantity: Number(item.quantity),
          totalWeight: normalizeDecimal(item.totalWeight),
          stoneWeight: normalizeDecimal(item.stoneWeight),
        },
      });
    } catch (error) {
      results.push({
        success: false,
        identifier: item.identifier || item.id || item.trayId || item.trayCode || item.trayName || item.name,
        message: error.message,
      });
    }
  }

  return {
    sold: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    results,
  };
};

const addStockToMultipleTrays = async (items) => {
  const results = [];

  for (const item of items) {
    try {
      const tray = await getTrayForStockChange(item);
      const updatedTray = await applyTrayStockAddition(tray, item);
      results.push({ success: true, data: updatedTray });
    } catch (error) {
      results.push({
        success: false,
        trayId: item.id || item.trayId,
        trayName: item.trayName || item.name,
        message: error.message,
      });
    }
  }

  return {
    updated: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    results,
  };
};

module.exports = {
  addStockToMultipleTrays,
  addTrayStock,
  addTrayStockByIdentifier,
  createTray,
  createMultipleTrays,
  getTrayById,
  getTrays,
  reduceTrayStock,
  sellFromTray,
  sellMultipleFromTrays,
  updateTray,
};
