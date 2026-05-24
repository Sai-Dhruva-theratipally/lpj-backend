const Inventory = require("../models/Inventory");
const StockTransaction = require("../models/StockTransaction");
const {
  generateBatchZpl,
  generateManualTextTagBatchZpl,
  generateTagLabelZpl,
  generateTrayLabelZpl,
} = require("./zplService");

const normalizeCode = (value) => String(value || "").trim().toUpperCase();
const normalizeNameKey = (value) => String(value || "").trim().toLowerCase();

const findInventoryForPrint = async ({ id, inventoryId, tagId, trayCode, trayName, stockType }) => {
  const identifier = id || inventoryId;
  const filters = [];

  if (identifier) {
    const idValue = String(identifier).trim();
    const numericId = Number(idValue);

    if (/^[a-f\d]{24}$/i.test(idValue)) {
      filters.push({ _id: idValue });
    }

    if (!Number.isNaN(numericId)) {
      filters.push({ tagId: numericId, stockType: "TAG" });
    }

    filters.push({ trayCode: normalizeCode(idValue), stockType: "TRAY" });
    filters.push({ trayNameKey: normalizeNameKey(idValue), stockType: "TRAY" });
  }

  if (tagId) {
    filters.push({ tagId: Number(tagId), stockType: "TAG" });
  }

  if (trayCode) {
    filters.push({ trayCode: normalizeCode(trayCode), stockType: "TRAY" });
  }

  if (trayName) {
    filters.push({ trayNameKey: normalizeNameKey(trayName), stockType: "TRAY" });
  }

  if (filters.length === 0) {
    const error = new Error("Inventory id, tag id, or tray id is required");
    error.statusCode = 400;
    throw error;
  }

  const inventory = await Inventory.findOne({
    isDeleted: { $ne: true },
    ...(stockType ? { stockType } : {}),
    $or: filters,
  });

  if (!inventory) {
    const error = new Error("Inventory item not found for printing");
    error.statusCode = 404;
    throw error;
  }

  return inventory;
};

const generateTagPrint = async (payload) => {
  const item = await findInventoryForPrint({ ...payload, stockType: "TAG" });
  const zpl = generateTagLabelZpl(item);

  return { zpl, items: [item], count: 1 };
};

const generateTrayPrint = async (payload) => {
  const item = await findInventoryForPrint({ ...payload, stockType: "TRAY" });
  const zpl = generateTrayLabelZpl(item);

  return { zpl, items: [item], count: 1 };
};

const isCompleteBatchItem = (item) => {
  if (item.stockType === "TAG") {
    return item.tagId && (item.weight !== undefined || item.grossWeight !== undefined);
  }

  if (item.stockType === "TRAY") {
    return (item.trayCode || item.categoryCode || item.trayName || item.category) && item.quantity !== undefined;
  }

  return false;
};

const getInventoryItemsFromBatchPayload = async (payload) => {
  if (payload.transactionId) {
    const transaction = await StockTransaction.findOne({ transactionId: payload.transactionId });

    if (!transaction) {
      const error = new Error("Stock transaction not found");
      error.statusCode = 404;
      throw error;
    }

    return transaction.items;
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    const error = new Error("At least one print item is required");
    error.statusCode = 400;
    throw error;
  }

  return Promise.all(
    payload.items.map((item) => {
      if (isCompleteBatchItem(item)) {
        return item;
      }

      return findInventoryForPrint(item);
    }),
  );
};

const generateBatchPrint = async (payload) => {
  const items = await getInventoryItemsFromBatchPayload(payload);
  const zpl = generateBatchZpl(items);

  return { zpl, items, count: items.length };
};

const generateManualTextTagPrint = async (payload) => {
  const quantity = Math.min(Math.max(Number(payload.quantity) || 1, 1), 100);
  const zpl = generateManualTextTagBatchZpl(payload, quantity);

  return {
    zpl,
    items: [{ category: payload.category, code: payload.code, quantity }],
    count: quantity,
  };
};

module.exports = {
  generateBatchPrint,
  generateManualTextTagPrint,
  generateTagPrint,
  generateTrayPrint,
};
