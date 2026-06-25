const Inventory = require("../models/Inventory");
const SaleTransaction = require("../models/SaleTransaction");

const toUpperKey = (value) => String(value || "").trim().toUpperCase();
const normalizeDecimal = (value, fallback = 0) => {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Number(number.toFixed(3)) : fallback;
};

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

const normalizeReceivedType = (value) => {
  const text = toUpperKey(value).replace(/[\s-]+/g, "_");
  if (text === "OLD" || text === "OLD_ORNAMENT" || text === "OLDORNAMENT") {
    return "OLD_ORNAMENT";
  }
  if (text === "RAW" || text === "RAW_METAL" || text === "RAWMETAL") {
    return "RAW_METAL";
  }
  return text;
};

const findInventoryByBarcode = async (barcode) => {
  const normalizedBarcode = toUpperKey(barcode);
  const numericBarcode = Number(normalizedBarcode);
  const filters = [
    { tagId: normalizedBarcode, stockType: "TAG" },
    { trayCode: normalizedBarcode, stockType: "TRAY" },
    { trayName: normalizedBarcode, stockType: "TRAY" },
    { category: normalizedBarcode, stockType: "TRAY" },
    { categoryCode: normalizedBarcode, stockType: "TRAY" },
  ];

  if (/^[a-f\d]{24}$/i.test(normalizedBarcode)) {
    filters.push({ _id: normalizedBarcode });
  }

  if (!Number.isNaN(numericBarcode)) {
    filters.push({ tagId: String(numericBarcode), stockType: "TAG" });
    filters.push({ tagId: numericBarcode, stockType: "TAG" });
  }

  return Inventory.findOne({
    isDeleted: { $ne: true },
    $or: filters,
  }).lean();
};

const getExistingCustomerNames = async () => {
  const rows = await SaleTransaction.distinct("customerName");
  return new Set(rows.map((name) => toUpperKey(name)).filter(Boolean));
};

const validateReceivedFields = (row, errors) => {
  const hasReceived = [
    row.receivedItemType,
    row.receivedMetal,
    row.receivedCategory,
    row.receivedWeight,
    row.purity,
  ].some(hasValue);

  if (!hasReceived) {
    return;
  }

  if (!["RAW_METAL", "OLD_ORNAMENT"].includes(row.receivedItemType)) {
    errors.push("Received Item Type must be Raw Metal or Old Ornament");
  }

  if (!["GOLD", "SILVER"].includes(row.receivedMetal)) {
    errors.push("Received Metal must be GOLD or SILVER");
  }

  if (!hasValue(row.receivedCategory)) {
    errors.push("Received Category is required when received item is entered");
  }

  const receivedWeight = Number(row.receivedWeight);
  if (!Number.isFinite(receivedWeight) || receivedWeight <= 0) {
    errors.push("Received Weight must be greater than 0");
  }

  if (row.receivedItemType === "OLD_ORNAMENT") {
    if (!hasValue(row.purity)) {
      errors.push("Purity is required for old ornaments");
      return;
    }

    const purity = Number(row.purity);
    if (!Number.isFinite(purity) || purity < 0 || purity > 100) {
      errors.push("Purity for old ornaments must be a percentage between 0 and 100");
    }
  }
};

const buildValidatedSaleItem = (row, inventory, errors) => {
  if (!inventory) {
    return null;
  }

  if (inventory.status !== "AVAILABLE") {
    errors.push(`Item ${row.barcode} is not available`);
  }

  if (inventory.stockType === "TAG") {
    return {
      inventoryId: inventory._id,
      identifier: inventory.tagId,
      stockType: "TAG",
      tagId: inventory.tagId,
      category: inventory.category,
      categoryCode: inventory.categoryCode,
      metalType: inventory.metalType,
      quantity: 1,
      weight: normalizeDecimal(inventory.weight),
      stoneWeight: normalizeDecimal(inventory.stoneWeight),
      rate: hasValue(row.rate) ? Number(row.rate) : undefined,
    };
  }

  const quantity = Number(row.quantity);
  const weight = Number(row.grossWeight);
  const stoneWeight = hasValue(row.stoneWeight) ? Number(row.stoneWeight) : 0;

  if (!Number.isInteger(quantity) || quantity < 1) {
    errors.push("Quantity is required for tray rows and must be at least 1");
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    errors.push("Gross Weight is required for tray rows and must be greater than 0");
  }

  if (!Number.isFinite(stoneWeight) || stoneWeight < 0) {
    errors.push("Stone Weight must be greater than or equal to 0");
  }

  if (Number.isFinite(quantity) && quantity > inventory.quantity) {
    errors.push(`Tray quantity exceeds available quantity ${inventory.quantity}`);
  }

  if (Number.isFinite(weight) && weight > inventory.totalWeight) {
    errors.push(`Tray gross weight exceeds available weight ${inventory.totalWeight}`);
  }

  if (Number.isFinite(stoneWeight) && stoneWeight > Number(inventory.stoneWeight || 0)) {
    errors.push(`Tray stone weight exceeds available stone weight ${inventory.stoneWeight || 0}`);
  }

  return {
    inventoryId: inventory._id,
    identifier: inventory.trayCode || inventory.trayName,
    stockType: "TRAY",
    trayCode: inventory.trayCode,
    category: inventory.category,
    categoryCode: inventory.categoryCode,
    metalType: inventory.metalType,
    quantity,
    weight: normalizeDecimal(weight),
    stoneWeight: normalizeDecimal(stoneWeight),
    rate: hasValue(row.rate) ? Number(row.rate) : undefined,
  };
};

const validateRate = (row, errors) => {
  if (!hasValue(row.rate)) {
    errors.push("Rate is required");
    return;
  }

  const rate = Number(row.rate);
  if (!Number.isFinite(rate) || rate < 0) {
    errors.push("Rate must be a non-negative number");
  }
};

const validateBulkSaleRows = async (rows = []) => {
  const existingCustomers = await getExistingCustomerNames();
  const reservations = new Map();
  const validatedRows = [];

  for (const row of rows) {
    const errors = [];
    const displayRow = {
      ...row,
      serialNo: String(row.serialNo || row.sNo || row.rowNumber || "").trim(),
      customerName: String(row.customerName || "").trim(),
      date: String(row.date || "").trim(),
      barcode: String(row.barcode || "").trim(),
      receivedItemType: String(row.receivedItemType || "").trim(),
      receivedMetal: String(row.receivedMetal || "").trim(),
      receivedCategory: String(row.receivedCategory || "").trim(),
      purity: String(row.purity || "").trim(),
    };
    const normalizedRow = {
      ...displayRow,
      serialNo: toUpperKey(displayRow.serialNo || row.rowNumber),
      customerName: displayRow.customerName,
      barcode: toUpperKey(row.barcode),
      receivedItemType: normalizeReceivedType(row.receivedItemType),
      receivedMetal: toUpperKey(row.receivedMetal),
      receivedCategory: toUpperKey(row.receivedCategory),
      purity: displayRow.purity,
    };

    if (!hasValue(normalizedRow.serialNo)) {
      errors.push("S.No is required");
    }

    if (!hasValue(normalizedRow.customerName)) {
      errors.push("Customer Name is required");
    }

    const saleDate = new Date(normalizedRow.date);
    if (!hasValue(normalizedRow.date) || Number.isNaN(saleDate.getTime())) {
      errors.push("Date is required and must be valid");
    }

    if (!hasValue(normalizedRow.barcode)) {
      errors.push("Barcode is required");
    }

    validateRate(normalizedRow, errors);
    validateReceivedFields({ ...displayRow, ...normalizedRow }, errors);

    const inventory = hasValue(normalizedRow.barcode) ? await findInventoryByBarcode(normalizedRow.barcode) : null;
    if (!inventory && hasValue(normalizedRow.barcode)) {
      errors.push(`Barcode ${normalizedRow.barcode} was not found`);
    }

    const saleItem = buildValidatedSaleItem(normalizedRow, inventory, errors);

    if (inventory && inventory.status === "AVAILABLE") {
      const key = String(inventory._id);
      const reserved = reservations.get(key) || { quantity: 0, weight: 0, stoneWeight: 0, tagUsed: false };

      if (inventory.stockType === "TAG") {
        if (reserved.tagUsed) {
          errors.push(`Tag ${inventory.tagId} is repeated in this import`);
        }
        reserved.tagUsed = true;
      } else if (saleItem) {
        reserved.quantity += Number(saleItem.quantity || 0);
        reserved.weight = Number((reserved.weight + Number(saleItem.weight || 0)).toFixed(3));
        reserved.stoneWeight = Number((reserved.stoneWeight + Number(saleItem.stoneWeight || 0)).toFixed(3));

        if (reserved.quantity > inventory.quantity) {
          errors.push(`Imported tray quantity total exceeds available quantity ${inventory.quantity}`);
        }
        if (reserved.weight > inventory.totalWeight) {
          errors.push(`Imported tray weight total exceeds available weight ${inventory.totalWeight}`);
        }
        if (reserved.stoneWeight > Number(inventory.stoneWeight || 0)) {
          errors.push(`Imported tray stone weight total exceeds available stone weight ${inventory.stoneWeight || 0}`);
        }
      }

      reservations.set(key, reserved);
    }

    validatedRows.push({
      ...displayRow,
      status: errors.length === 0 ? "VALID" : "INVALID",
      errors,
      customerExists: existingCustomers.has(toUpperKey(normalizedRow.customerName)),
      normalized: {
        serialNo: normalizedRow.serialNo,
        barcode: normalizedRow.barcode,
        receivedItemType: normalizedRow.receivedItemType,
        receivedMetal: normalizedRow.receivedMetal,
        receivedCategory: normalizedRow.receivedCategory,
      },
      inventory: inventory
        ? {
            inventoryId: inventory._id,
            stockType: inventory.stockType,
            identifier: inventory.tagId || inventory.trayCode || inventory.trayName,
            available: inventory.status === "AVAILABLE",
            quantity: inventory.stockType === "TAG" ? 1 : inventory.quantity,
            weight: inventory.stockType === "TAG" ? inventory.weight : inventory.totalWeight,
            stoneWeight: inventory.stoneWeight || 0,
          }
        : null,
      saleItem,
    });
  }

  return {
    rows: validatedRows,
    isValid: validatedRows.every((row) => row.status === "VALID"),
    validCount: validatedRows.filter((row) => row.status === "VALID").length,
    invalidCount: validatedRows.filter((row) => row.status === "INVALID").length,
  };
};

module.exports = {
  validateBulkSaleRows,
};
