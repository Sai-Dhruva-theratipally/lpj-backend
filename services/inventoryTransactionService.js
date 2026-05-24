const Counter = require("../models/Counter");
const Inventory = require("../models/Inventory");
const SaleTransaction = require("../models/SaleTransaction");
const StockTransaction = require("../models/StockTransaction");
const categoryService = require("./categoryService");
const sellerService = require("./sellerService");
const { getNextTagCode } = require("../utils/tagCode");

const normalizeCode = (value) => value.trim().toUpperCase();
const normalizeNameKey = (value) => value.trim().toLowerCase();

const nextSequence = async (counterId, startAt) => {
  const counter = await Counter.findByIdAndUpdate(counterId, { $inc: { seq: 1 } }, { new: true });

  if (counter) {
    return counter.seq;
  }

  try {
    const createdCounter = await Counter.create({ _id: counterId, seq: startAt });
    return createdCounter.seq;
  } catch (error) {
    if (error.code === 11000) {
      return nextSequence(counterId, startAt);
    }

    throw error;
  }
};

const getNextStockTransactionId = async () => `STK-${await nextSequence("stockTransactionId", 1001)}`;
const getNextSaleId = async () => `SALE-${await nextSequence("saleTransactionId", 1001)}`;

const calculateAverageWeight = (quantity, totalWeight) => {
  return quantity > 0 ? Number((totalWeight / quantity).toFixed(3)) : 0;
};

const normalizeDecimal = (value, fallback = 0) => {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Number(number.toFixed(3)) : fallback;
};

const findInventoryByIdentifier = async (identifier) => {
  const trimmedIdentifier = String(identifier || "").trim();

  if (!trimmedIdentifier) {
    const error = new Error("Barcode or id is required");
    error.statusCode = 400;
    throw error;
  }

  const numericIdentifier = Number(trimmedIdentifier);
  const isMongoId = /^[a-f\d]{24}$/i.test(trimmedIdentifier);

  const filters = [
    { trayCode: normalizeCode(trimmedIdentifier), stockType: "TRAY" },
    { trayNameKey: normalizeNameKey(trimmedIdentifier), stockType: "TRAY" },
  ];

  if (!Number.isNaN(numericIdentifier)) {
    filters.push({ tagId: numericIdentifier, stockType: "TAG" });
  }

  if (isMongoId) {
    filters.push({ _id: trimmedIdentifier });
  }

  const inventory = await Inventory.findOne({
    isDeleted: { $ne: true },
    $or: filters,
  });

  if (!inventory) {
    const error = new Error("Inventory item not found");
    error.statusCode = 404;
    throw error;
  }

  return inventory;
};

const getInventoryLookup = async (identifier) => {
  const inventory = await findInventoryByIdentifier(identifier);

  return {
    inventoryId: inventory._id,
    identifier: inventory.stockType === "TAG" ? inventory.tagId : inventory.trayCode || inventory.trayName,
    stockType: inventory.stockType,
    category: inventory.category,
    categoryCode: inventory.categoryCode,
    metalType: inventory.metalType,
    quantity: inventory.stockType === "TAG" ? inventory.pieces || 1 : inventory.quantity,
    weight: inventory.stockType === "TAG" ? inventory.weight : inventory.totalWeight,
    grossWeight: inventory.stockType === "TAG" ? inventory.grossWeight || inventory.weight : inventory.grossWeight || inventory.totalWeight,
    stoneWeight: inventory.stoneWeight || 0,
    sellerName: inventory.sellerName,
    status: inventory.status,
    available: inventory.status === "AVAILABLE" && !inventory.isDeleted && (inventory.stockType === "TAG" || inventory.quantity > 0),
  };
};

const createOrUpdateTrayFromStockItem = async (item, seller, transactionDate) => {
  const category = await categoryService.findCategoryByNameOrCode({
    input: item.categoryInput || item.category || item.categoryCode,
    stockType: "TRAY",
    metalType: item.metalType,
  });

  if (!category) {
    const error = new Error("Category/Tray does not exist");
    error.statusCode = 404;
    throw error;
  }

  const trayCode = normalizeCode(category.categoryCode);
  const trayName = category.name;
  const trayNameKey = normalizeNameKey(trayName);
  const quantity = Number(item.quantity);
  const weight = normalizeDecimal(item.weight);
  const stoneWeight = normalizeDecimal(item.stoneWeight);

  let tray = await Inventory.findOne({
    stockType: "TRAY",
    metalType: category.metalType,
    $or: [{ trayCode }, { trayNameKey }],
  });

  if (!tray) {
    tray = await Inventory.create({
      stockType: "TRAY",
      trayCode,
      trayName,
      trayNameKey,
      category: category.name,
      categoryCode: category.categoryCode,
      metalType: category.metalType,
      quantity: 0,
      totalWeight: 0,
      grossWeight: 0,
      stoneWeight: 0,
      status: "AVAILABLE",
    });
  }

  tray.category = category.name;
  tray.categoryCode = category.categoryCode;
  tray.metalType = category.metalType;
  tray.seller = seller._id;
  tray.sellerName = seller.name;
  tray.purchaseDate = transactionDate;
  tray.quantity += quantity;
  tray.totalWeight = Number((tray.totalWeight + weight).toFixed(3));
  tray.grossWeight = tray.totalWeight;
  tray.stoneWeight = Number(((tray.stoneWeight || 0) + stoneWeight).toFixed(3));
  tray.averageWeight = calculateAverageWeight(tray.quantity, tray.totalWeight);
  tray.stockEntries.push({
    seller: seller._id,
    sellerName: seller.name,
    quantity,
    totalWeight: weight,
    stoneWeight,
    purchaseDate: transactionDate,
  });

  const savedTray = await tray.save();

  return {
    stockType: "TRAY",
    inventoryId: savedTray._id,
    trayCode: savedTray.trayCode,
    category: savedTray.category,
    categoryCode: savedTray.categoryCode,
    metalType: savedTray.metalType,
    quantity,
    weight,
    stoneWeight,
  };
};

const createTagsFromStockItem = async (item, seller, transactionDate, category) => {
  const quantity = Number(item.quantity || 1);
  const totalWeight = normalizeDecimal(item.weight);
  const totalStoneWeight = normalizeDecimal(item.stoneWeight);
  const perTagWeight = Number((totalWeight / quantity).toFixed(3));
  const perTagStoneWeight = Number((totalStoneWeight / quantity).toFixed(3));
  const transactionItems = [];

  for (let index = 0; index < quantity; index += 1) {
    const tagId = await getNextTagCode();
    const tag = await Inventory.create({
      stockType: "TAG",
      tagId,
      category: category.name,
      categoryCode: category.categoryCode,
      metalType: category.metalType,
      pieces: 1,
      weight: perTagWeight,
      grossWeight: perTagWeight,
      stoneWeight: perTagStoneWeight,
      seller: seller._id,
      sellerName: seller.name,
      purchaseDate: transactionDate,
      status: "AVAILABLE",
      isDeleted: false,
    });

    transactionItems.push({
      stockType: "TAG",
      inventoryId: tag._id,
      tagId: tag.tagId,
      category: tag.category,
      categoryCode: tag.categoryCode,
      metalType: tag.metalType,
      quantity: 1,
      weight: tag.weight,
      stoneWeight: tag.stoneWeight || 0,
      sellerName: seller.name,
    });
  }

  return transactionItems;
};

const createStockTransaction = async (payload) => {
  const seller = await sellerService.findOrCreateSeller(payload.sellerName);
  const transactionDate = new Date(payload.date);
  const transactionItems = [];

  for (const item of payload.items) {
    const category = await categoryService.findCategoryByNameOrCode({
      input: item.categoryInput || item.category || item.categoryCode,
      stockType: item.stockType,
      metalType: item.metalType,
    });

    if (!category) {
      const error = new Error("Category/Tray does not exist");
      error.statusCode = 404;
      throw error;
    }

    if (item.stockType === "TAG") {
      const tagItems = await createTagsFromStockItem(item, seller, transactionDate, category);
      transactionItems.push(...tagItems);
    } else {
      const trayItem = await createOrUpdateTrayFromStockItem(item, seller, transactionDate);
      transactionItems.push(trayItem);
    }
  }

  const totalItems = transactionItems.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalWeight = Number(transactionItems.reduce((sum, item) => sum + Number(item.weight), 0).toFixed(3));
  const totalStoneWeight = Number(transactionItems.reduce((sum, item) => sum + Number(item.stoneWeight || 0), 0).toFixed(3));

  return StockTransaction.create({
    transactionId: await getNextStockTransactionId(),
    seller: seller._id,
    sellerName: seller.name,
    date: transactionDate,
    items: transactionItems,
    totalItems,
    totalWeight,
    totalStoneWeight,
  });
};

const applyTraySale = async (inventory, item, saleDate) => {
  const quantity = Number(item.quantity || 1);
  const weight = normalizeDecimal(item.weight);
  const stoneWeight = normalizeDecimal(item.stoneWeight);

  if (quantity > inventory.quantity) {
    const error = new Error(`Cannot sell more quantity than available in tray ${inventory.trayCode || inventory.trayName}`);
    error.statusCode = 400;
    throw error;
  }

  if (weight > inventory.totalWeight) {
    const error = new Error(`Cannot sell more weight than available in tray ${inventory.trayCode || inventory.trayName}`);
    error.statusCode = 400;
    throw error;
  }

  if (stoneWeight > (inventory.stoneWeight || 0)) {
    const error = new Error(`Cannot sell more stone weight than available in tray ${inventory.trayCode || inventory.trayName}`);
    error.statusCode = 400;
    throw error;
  }

  inventory.quantity -= quantity;
  inventory.totalWeight = Number((inventory.totalWeight - weight).toFixed(3));
  inventory.grossWeight = inventory.totalWeight;
  inventory.stoneWeight = Number(((inventory.stoneWeight || 0) - stoneWeight).toFixed(3));
  inventory.averageWeight = calculateAverageWeight(inventory.quantity, inventory.totalWeight);
  inventory.saleDate = saleDate;
  await inventory.save();

  return {
    inventoryId: inventory._id,
    stockType: "TRAY",
    trayCode: inventory.trayCode,
    sellerName: inventory.sellerName,
    category: inventory.category,
    categoryCode: inventory.categoryCode,
    metalType: inventory.metalType,
    quantity,
    weight,
    stoneWeight,
  };
};

const applyTagSale = async (inventory, saleDate) => {
  if (inventory.status !== "AVAILABLE") {
    const error = new Error(`Tag ${inventory.tagId} is not available`);
    error.statusCode = 400;
    throw error;
  }

  inventory.status = "SOLD";
  inventory.saleDate = saleDate;
  await inventory.save();

  return {
    inventoryId: inventory._id,
    stockType: "TAG",
    tagId: inventory.tagId,
    sellerName: inventory.sellerName,
    category: inventory.category,
    categoryCode: inventory.categoryCode,
    metalType: inventory.metalType,
    quantity: inventory.pieces || 1,
    weight: inventory.weight,
    stoneWeight: inventory.stoneWeight || 0,
  };
};

const createSaleTransaction = async (payload) => {
  const saleDate = new Date(payload.date);
  const saleItems = [];

  for (const item of payload.items) {
    const inventory = item.inventoryId
      ? await Inventory.findOne({ _id: item.inventoryId, isDeleted: { $ne: true } })
      : await findInventoryByIdentifier(item.identifier || item.barcode || item.id);

    if (!inventory) {
      const error = new Error("Inventory item not found");
      error.statusCode = 404;
      throw error;
    }

    if (inventory.stockType === "TAG") {
      saleItems.push(await applyTagSale(inventory, saleDate));
    } else {
      saleItems.push(await applyTraySale(inventory, item, saleDate));
    }
  }

  const totalItems = saleItems.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalWeight = Number(saleItems.reduce((sum, item) => sum + Number(item.weight), 0).toFixed(3));
  const totalStoneWeight = Number(saleItems.reduce((sum, item) => sum + Number(item.stoneWeight || 0), 0).toFixed(3));

  return SaleTransaction.create({
    saleId: await getNextSaleId(),
    customerName: payload.customerName.trim(),
    date: saleDate,
    items: saleItems,
    totalItems,
    totalWeight,
    totalStoneWeight,
  });
};

module.exports = {
  createSaleTransaction,
  createStockTransaction,
  getInventoryLookup,
};
