const inventoryTransactionService = require("./inventoryTransactionService");
const manualRateService = require("./manualRateService");
const { validateBulkSaleRows } = require("./bulkSaleValidationService");

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";
const toUpperKey = (value) => String(value || "").trim().toUpperCase();

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

const buildReceivedItems = (rows) => {
  const receivedItems = [];
  const seen = new Set();

  rows.forEach((row) => {
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

    const item = {
      itemType: row.normalized?.receivedItemType || normalizeReceivedType(row.receivedItemType),
      metalType: row.normalized?.receivedMetal || toUpperKey(row.receivedMetal),
      category: row.receivedCategory,
      weight: Number(row.receivedWeight),
      purity: row.purity || "",
    };
    const key = JSON.stringify(item);

    if (!seen.has(key)) {
      seen.add(key);
      receivedItems.push(item);
    }
  });

  return receivedItems;
};

const groupValidatedRows = (rows) => {
  const billMap = new Map();

  rows.forEach((row) => {
    if (!billMap.has(row.serialNo)) {
      billMap.set(row.serialNo, {
        serialNo: row.serialNo,
        customerName: row.customerName,
        date: row.date,
        rows: [],
      });
    }

    billMap.get(row.serialNo).rows.push(row);
  });

  return Array.from(billMap.values()).map((bill) => {
    const saleItems = bill.rows.map((row) => row.saleItem);
    const receivedItems = buildReceivedItems(bill.rows);

    return {
      ...bill,
      saleItems,
      receivedItems,
      totals: {
        soldItems: saleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        soldWeight: Number(saleItems.reduce((sum, item) => sum + Number(item.weight || 0), 0).toFixed(3)),
        soldStoneWeight: Number(saleItems.reduce((sum, item) => sum + Number(item.stoneWeight || 0), 0).toFixed(3)),
        receivedItems: receivedItems.length,
        receivedWeight: Number(receivedItems.reduce((sum, item) => sum + Number(item.weight || 0), 0).toFixed(3)),
      },
    };
  });
};

const getBulkSalePreview = async (rows = []) => {
  const validation = await validateBulkSaleRows(rows);

  if (!validation.isValid) {
    const error = new Error("All rows must be valid before preview");
    error.statusCode = 400;
    error.data = validation;
    throw error;
  }

  return {
    ...validation,
    bills: groupValidatedRows(validation.rows),
  };
};

const createBulkSales = async (rows = []) => {
  const preview = await getBulkSalePreview(rows);
  const createdSales = [];

  for (const bill of preview.bills) {
    const sale = await inventoryTransactionService.createSaleTransaction({
      customerName: bill.customerName,
      date: bill.date,
      items: bill.saleItems.map((item) => ({
        inventoryId: item.inventoryId,
        identifier: item.identifier,
        quantity: item.quantity,
        weight: item.weight,
        stoneWeight: item.stoneWeight || 0,
        rate: item.rate,
      })),
      receivedItems: bill.receivedItems,
    });

    if (sale._id) {
      await manualRateService.saveTransactionRates(sale._id, "SaleTransaction", sale.rates || {});
    }

    createdSales.push({
      serialNo: bill.serialNo,
      saleId: sale.saleId,
      customerName: sale.customerName,
      totalItems: sale.totalItems,
      totalWeight: sale.totalWeight,
      totalReceivedWeight: sale.totalReceivedWeight,
    });
  }

  return {
    createdCount: createdSales.length,
    sales: createdSales,
  };
};

module.exports = {
  createBulkSales,
  getBulkSalePreview,
};
