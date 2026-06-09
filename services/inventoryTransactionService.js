const Counter = require("../models/Counter");
const Inventory = require("../models/Inventory");
const SaleTransaction = require("../models/SaleTransaction");
const StockTransaction = require("../models/StockTransaction");
const categoryService = require("./categoryService");
const sellerService = require("./sellerService");
const { getNextTagCode } = require("../utils/tagCode");

const normalizeToUppercase = (value) => value.trim().toUpperCase();

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

const normalizeReceivedItems = (items = []) =>
  items
    .filter((item) => item && (item.itemType || item.metalType || item.category || item.weight || item.purity))
    .map((item) => ({
      itemType: normalizeToUppercase(item.itemType || ""),
      metalType: normalizeToUppercase(item.metalType || ""),
      category: normalizeToUppercase(item.category || ""),
      weight: normalizeDecimal(item.weight),
      purity: item.itemType === "OLD_ORNAMENT" ? normalizeToUppercase(item.purity || "") : "",
    }));

const findInventoryByIdentifier = async (identifier) => {
  const normalizedIdentifier = normalizeToUppercase(identifier || "");

  if (!normalizedIdentifier) {
    const error = new Error("Barcode or id is required");
    error.statusCode = 400;
    throw error;
  }

  const numericIdentifier = Number(normalizedIdentifier);
  const isMongoId = /^[a-f\d]{24}$/i.test(normalizedIdentifier);

  const filters = [
    { tagId: normalizedIdentifier, stockType: "TAG" },
    { trayCode: normalizedIdentifier, stockType: "TRAY" },
    { trayName: normalizedIdentifier, stockType: "TRAY" },
    { category: normalizedIdentifier, stockType: "TRAY" },
    { categoryCode: normalizedIdentifier, stockType: "TRAY" },
  ];

  if (!Number.isNaN(numericIdentifier)) {
    filters.push({ tagId: String(numericIdentifier), stockType: "TAG" });
    filters.push({ tagId: numericIdentifier, stockType: "TAG" });
  }

  if (isMongoId) {
    filters.push({ _id: normalizedIdentifier });
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

  const trayCode = normalizeToUppercase(category.categoryCode);
  const trayName = normalizeToUppercase(category.name);
  const quantity = Number(item.quantity);
  const weight = normalizeDecimal(item.weight);
  const stoneWeight = normalizeDecimal(item.stoneWeight);

  let tray = await Inventory.findOne({
    stockType: "TRAY",
    metalType: category.metalType,
    $or: [{ trayCode }, { trayName }],
  });

  if (!tray) {
    tray = await Inventory.create({
      stockType: "TRAY",
      trayCode,
      trayName,
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
    const tagId = await getNextTagCode(category.categoryCode);
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
  const receivedItems = normalizeReceivedItems(payload.receivedItems);
  const totalReceivedWeight = Number(receivedItems.reduce((sum, item) => sum + Number(item.weight || 0), 0).toFixed(3));

  return SaleTransaction.create({
    saleId: await getNextSaleId(),
    customerName: payload.customerName.trim(),
    date: saleDate,
    items: saleItems,
    totalItems,
    totalWeight,
    totalStoneWeight,
    receivedItems,
    totalReceivedWeight,
  });
};

const getSuggestions = async (searchTerm, limit = 10) => {
  const normalizedSearch = normalizeToUppercase(searchTerm || "");

  if (!normalizedSearch || normalizedSearch.length < 1) {
    return [];
  }

  const numericSearch = Number(normalizedSearch);
  const regexPattern = new RegExp(normalizedSearch, "i");

  // Build filters for different search types
  const filters = [
    // Tray searches
    { trayCode: regexPattern, stockType: "TRAY", status: "AVAILABLE" },
    { trayName: regexPattern, stockType: "TRAY", status: "AVAILABLE" },
    { category: regexPattern, stockType: "TRAY", status: "AVAILABLE" },
    { categoryCode: regexPattern, stockType: "TRAY", status: "AVAILABLE" },
    // Tag searches support new category-prefixed codes and legacy numeric codes.
    ...(Number.isFinite(numericSearch) && !Number.isNaN(numericSearch)
      ? [{ tagId: normalizedSearch, stockType: "TAG", status: "AVAILABLE" }, { tagId: numericSearch, stockType: "TAG", status: "AVAILABLE" }]
      : [{ tagId: regexPattern, stockType: "TAG", status: "AVAILABLE" }]),
  ];

  const results = await Promise.all(
    filters.map((filter) =>
      Inventory.find({ ...filter, isDeleted: { $ne: true } })
        .select("_id tagId trayCode trayName category categoryCode stockType metalType quantity weight status")
        .limit(limit)
        .lean()
    )
  );

  // Flatten and deduplicate results
  const uniqueResults = new Map();
  results.flat().forEach((item) => {
    const key = item._id.toString();
    if (!uniqueResults.has(key)) {
      uniqueResults.set(key, item);
    }
  });

  // Format suggestions for display
  return Array.from(uniqueResults.values()).map((item) => ({
    inventoryId: item._id,
    displayText:
      item.stockType === "TAG" ? `Tag #${item.tagId}` : `${item.trayCode || item.trayName} (${item.category})`,
    value: item.stockType === "TAG" ? item.tagId.toString() : item.trayCode || item.trayName,
    type: item.stockType,
    tagId: item.tagId,
    trayCode: item.trayCode,
    trayName: item.trayName,
    category: item.category,
    categoryCode: item.categoryCode,
    metalType: item.metalType,
    quantity: item.quantity,
    weight: item.weight,
  }));
};

const searchBills = async (query = {}) => {
  const match = {};
  const regexPattern = new RegExp(normalizeToUppercase(query.search || ""), "i");

  if (query.search) {
    match.$or = [
      { saleId: regexPattern },
      { customerName: regexPattern },
      { "items.category": regexPattern },
      { "receivedItems.category": regexPattern },
    ];
  }

  if (query.fromDate || query.toDate) {
    match.date = {};
    if (query.fromDate) match.date.$gte = new Date(query.fromDate);
    if (query.toDate) {
      const end = new Date(query.toDate);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }

  const bills = await SaleTransaction.find(match)
    .select("saleId customerName date totalItems totalWeight totalReceivedWeight items receivedItems status")
    .sort({ date: -1 })
    .limit(100)
    .lean();

  return bills.map((bill) => ({
    saleId: bill.saleId,
    customer: bill.customerName,
    date: new Date(bill.date).toISOString().split("T")[0],
    soldItems: bill.totalItems || 0,
    totalWeight: Number((bill.totalWeight || 0).toFixed(3)),
    receivedWeight: Number((bill.totalReceivedWeight || 0).toFixed(3)),
    status: bill.status || "ACTIVE",
  }));
};

const getBillDetails = async (saleId) => {
  const bill = await SaleTransaction.findOne({ saleId });

  if (!bill) {
    const error = new Error("Bill not found");
    error.statusCode = 404;
    throw error;
  }

  return {
    saleId: bill.saleId,
    customerName: bill.customerName,
    date: new Date(bill.date).toISOString().split("T")[0],
    status: bill.status || "ACTIVE",
    soldItems: (bill.items || []).map((item, index) => {
      const identifier = item.tagId || item.trayCode;
      return {
        index,
        inventoryId: item.inventoryId,
        stockType: item.stockType,
        identifier: item.isReturned ? `${identifier} *` : identifier,
        metalType: item.metalType,
        category: item.category,
        categoryCode: item.categoryCode,
        quantity: item.quantity,
        weight: Number(item.weight.toFixed(3)),
        stoneWeight: Number((item.stoneWeight || 0).toFixed(3)),
        seller: item.sellerName,
        isReturned: item.isReturned || false,
      };
    }),
    receivedItems: (bill.receivedItems || []).map((item, index) => ({
      index,
      itemType: item.isCancelled ? `${item.itemType} *` : item.itemType,
      metalType: item.metalType,
      category: item.category,
      weight: Number(item.weight.toFixed(3)),
      purity: item.purity || "",
      isCancelled: item.isCancelled || false,
    })),
    totals: {
      soldItems: bill.totalItems || 0,
      soldWeight: Number((bill.totalWeight || 0).toFixed(3)),
      soldStoneWeight: Number((bill.totalStoneWeight || 0).toFixed(3)),
      receivedItems: (bill.receivedItems || []).length,
      receivedWeight: Number((bill.totalReceivedWeight || 0).toFixed(3)),
    },
  };
};

const returnBillItems = async (payload) => {
  const { saleId, itemIndicesToReturn, receivedItemIndicesToCancel } = payload;

  if (!saleId || (!Array.isArray(itemIndicesToReturn) || itemIndicesToReturn.length === 0) && (!Array.isArray(receivedItemIndicesToCancel) || receivedItemIndicesToCancel.length === 0)) {
    const error = new Error("saleId and at least itemIndicesToReturn or receivedItemIndicesToCancel array are required");
    error.statusCode = 400;
    throw error;
  }

  const bill = await SaleTransaction.findOne({ saleId });

  if (!bill) {
    const error = new Error("Bill not found");
    error.statusCode = 404;
    throw error;
  }

  const returnedItems = [];
  const cancelledItems = [];

  // Handle sold items returns
  if (Array.isArray(itemIndicesToReturn) && itemIndicesToReturn.length > 0) {
    for (const index of itemIndicesToReturn) {
      if (index < 0 || index >= bill.items.length) {
        continue;
      }

      const item = bill.items[index];

      if (!item || !item.inventoryId) {
        continue;
      }

      const inventory = await Inventory.findById(item.inventoryId);

      if (!inventory) {
        continue;
      }

      if (item.stockType === "TAG") {
        // Reset tag status from SOLD to AVAILABLE
        inventory.status = "AVAILABLE";
        inventory.saleDate = null;
        await inventory.save();
      } else {
        // Return tray quantity and weight
        inventory.quantity += Number(item.quantity || 0);
        inventory.totalWeight = Number((Number(inventory.totalWeight) + Number(item.weight)).toFixed(3));
        inventory.grossWeight = inventory.totalWeight;
        inventory.stoneWeight = Number((Number(inventory.stoneWeight || 0) + Number(item.stoneWeight || 0)).toFixed(3));
        inventory.saleDate = null;
        await inventory.save();
      }

      // Mark item as returned instead of deleting
      bill.items[index].isReturned = true;

      returnedItems.push({
        stockType: item.stockType,
        identifier: item.tagId || item.trayCode,
        quantity: item.quantity,
        weight: item.weight,
      });
    }
  }

  // Handle received items cancellation
  if (Array.isArray(receivedItemIndicesToCancel) && receivedItemIndicesToCancel.length > 0) {
    for (const index of receivedItemIndicesToCancel) {
      if (index < 0 || index >= (bill.receivedItems || []).length) {
        continue;
      }

      // Mark received item as cancelled
      bill.receivedItems[index].isCancelled = true;

      cancelledItems.push({
        itemType: bill.receivedItems[index].itemType,
        metalType: bill.receivedItems[index].metalType,
        category: bill.receivedItems[index].category,
        weight: bill.receivedItems[index].weight,
      });
    }
  }

  // Recalculate totals excluding returned items
  const activeItems = bill.items.filter((item) => !item.isReturned);
  bill.totalItems = activeItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  bill.totalWeight = Number(activeItems.reduce((sum, item) => sum + Number(item.weight || 0), 0).toFixed(3));
  bill.totalStoneWeight = Number(activeItems.reduce((sum, item) => sum + Number(item.stoneWeight || 0), 0).toFixed(3));

  // Recalculate received totals excluding cancelled items
  const activeReceivedItems = (bill.receivedItems || []).filter((item) => !item.isCancelled);
  bill.totalReceivedItems = activeReceivedItems.length;
  bill.totalReceivedWeight = Number(activeReceivedItems.reduce((sum, item) => sum + Number(item.weight || 0), 0).toFixed(3));

  const hasReturnedItems = bill.items.some((item) => item.isReturned);
  bill.status = activeItems.length === 0 ? "RETURNED" : hasReturnedItems ? "PARTIALLY_RETURNED" : "ACTIVE";
  bill.returnedAt = hasReturnedItems ? new Date() : undefined;

  await bill.save();

  const messages = [];
  if (returnedItems.length > 0) {
    messages.push(`${returnedItems.length} sold item(s) returned`);
  }
  if (cancelledItems.length > 0) {
    messages.push(`${cancelledItems.length} received item(s) cancelled`);
  }

  return {
    success: true,
    message: messages.join(" and "),
    returnedItems,
    cancelledItems,
  };
};

module.exports = {
  createSaleTransaction,
  createStockTransaction,
  getBillDetails,
  getInventoryLookup,
  getSuggestions,
  returnBillItems,
  searchBills,
};
