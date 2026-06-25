const Inventory = require("../models/Inventory");
const Sale = require("../models/Sale");
const SaleTransaction = require("../models/SaleTransaction");
const StockTransaction = require("../models/StockTransaction");

const REPORT_TITLES = {
  "stock-summary": "Stock Summary Report",
  "stock-detailed": "Stock Detailed Report",
  "sales-summary": "Sales Summary Report",
  "sales-detailed": "Sales Detailed Report",
  "stock-inward-summary": "Stock Inward Summary Report",
  "stock-inward-detailed": "Stock Inward Detailed Report",
  "cancelled-sales": "Cancelled Sales Report",
  "current-inventory": "Current Inventory Report",
  "available-stock": "Available Stock Report",
  "sold-stock": "Sold Stock Report",
  "stone-weight": "Stone Weight Report",
};

const DEFAULT_REPORT_TYPE = {
  stock: "stock-summary",
  sales: "sales-summary",
  stockInward: "stock-inward-summary",
  inventory: "current-inventory",
};

const toDateRange = (query = {}) => {
  const match = {};

  if (query.fromDate || query.toDate) {
    match.$gte = query.fromDate ? new Date(query.fromDate) : new Date("1970-01-01");
    if (query.toDate) {
      const end = new Date(query.toDate);
      end.setHours(23, 59, 59, 999);
      match.$lte = end;
    }
  }

  return Object.keys(match).length ? match : null;
};

const cleanFilters = (query = {}) => ({
  fromDate: query.fromDate || "",
  toDate: query.toDate || "",
  metalType: query.metalType || "",
  category: query.category || "",
  seller: query.seller || "",
  customer: query.customer || "",
  source: query.source || "",
  stockType: query.stockType || "",
  groupBy: query.groupBy || "",
  reportType: query.reportType || "",
});

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const textRegex = (value) => new RegExp(escapeRegex(String(value).trim().toUpperCase()));

const round = (value) => Number((Number(value || 0)).toFixed(3));
const metalRank = (metalType) => ({ GOLD: 0, SILVER: 1, OTHERS: 2 }[String(metalType || "").toUpperCase()] ?? 3);
const sortReportRows = (rows = []) =>
  [...rows].sort((first, second) => {
    const firstName = String(first.category || first.item || first.source || first.customer || first.seller || first.date || "").toUpperCase();
    const secondName = String(second.category || second.item || second.source || second.customer || second.seller || second.date || "").toUpperCase();
    const firstId = String(first.tagNumber || first.tagId || first.identifier || first.categoryCode || first.stockType || "").toUpperCase();
    const secondId = String(second.tagNumber || second.tagId || second.identifier || second.categoryCode || second.stockType || "").toUpperCase();

    return (
      metalRank(first.metalType) - metalRank(second.metalType) ||
      firstName.localeCompare(secondName) ||
      firstId.localeCompare(secondId, undefined, { numeric: true })
    );
  });

const totalsFromRows = (rows) => ({
  quantity: rows.reduce((sum, row) => sum + Number(row.quantity || row.pieces || 0), 0),
  grossWeight: round(rows.reduce((sum, row) => sum + Number(row.grossWeight ?? row.weight ?? 0), 0)),
  stoneWeight: round(rows.reduce((sum, row) => sum + Number(row.stoneWeight || 0), 0)),
});

const transactionMatchStages = (query, kind) => {
  const rootMatch = {};
  const itemMatch = {};
  const dateRange = toDateRange(query);

  if (dateRange) rootMatch.date = dateRange;
  if (query.seller && kind === "stock") rootMatch.sellerName = textRegex(query.seller);
  if (query.customer && kind === "sales") rootMatch.customerName = textRegex(query.customer);
  if (query.metalType) itemMatch["items.metalType"] = query.metalType;
  if (query.category) itemMatch["items.category"] = textRegex(query.category);
  if (query.stockType) itemMatch["items.stockType"] = query.stockType;

  return [
    ...(Object.keys(rootMatch).length ? [{ $match: rootMatch }] : []),
    { $unwind: "$items" },
    ...(Object.keys(itemMatch).length ? [{ $match: itemMatch }] : []),
  ];
};

const groupTransactionBy = (field, labelField = "label") => [
  {
    $group: {
      _id: field,
      quantity: { $sum: "$items.quantity" },
      grossWeight: { $sum: "$items.weight" },
      stoneWeight: { $sum: "$items.stoneWeight" },
      transactions: { $addToSet: "$_id" },
    },
  },
  {
    $project: {
      _id: 0,
      [labelField]: "$_id",
      quantity: 1,
      grossWeight: { $round: ["$grossWeight", 3] },
      stoneWeight: { $round: ["$stoneWeight", 3] },
      transactionCount: { $size: "$transactions" },
    },
  },
  { $sort: { [labelField]: 1 } },
];

const inventoryMatch = (query = {}) => {
  const match = { isDeleted: { $ne: true }, status: "AVAILABLE" };
  const dateRange = toDateRange(query);

  if (dateRange) match.purchaseDate = dateRange;
  if (query.metalType) match.metalType = query.metalType;
  if (query.category) match.category = textRegex(query.category);
  if (query.seller) match.sellerName = textRegex(query.seller);
  if (query.stockType) match.stockType = query.stockType;

  return match;
};

const inwardRootMatch = (query = {}) => {
  const match = {};
  const dateRange = toDateRange(query);

  if (dateRange) match.date = dateRange;
  if (query.customer || query.source) match.customerName = textRegex(query.customer || query.source);

  return match;
};

const stockInwardSellerRootMatch = (query = {}) => {
  const match = {};
  const dateRange = toDateRange(query);

  if (dateRange) match.date = dateRange;
  if (query.seller || query.source) match.sellerName = textRegex(query.seller || query.source);

  return match;
};

const stockInwardSellerItemMatch = (query = {}) => {
  const match = {};

  if (query.metalType) match["items.metalType"] = query.metalType;
  if (query.category) match["items.category"] = textRegex(query.category);
  if (query.stockType && ["TAG", "TRAY"].includes(query.stockType)) match["items.stockType"] = query.stockType;
  if (query.stockType && ["RAW_METAL", "OLD_ORNAMENT"].includes(query.stockType)) match.__skipSellerItems = true;

  return match;
};

const inwardItemMatch = (query = {}) => {
  const match = {};

  if (query.metalType) match["receivedItems.metalType"] = query.metalType;
  if (query.category) match["receivedItems.category"] = textRegex(query.category);
  if (query.stockType) match["receivedItems.itemType"] = query.stockType;

  return match;
};

const getStockSummaryRows = async (query = {}) => {
  const inventoryRows = await Inventory.aggregate([
    { $match: inventoryMatch(query) },
    {
      $group: {
        _id: {
          metalType: "$metalType",
          stockType: "$stockType",
          category: "$category",
          categoryCode: "$categoryCode",
        },
        pieces: {
          $sum: {
            $cond: [{ $eq: ["$stockType", "TAG"] }, { $ifNull: ["$pieces", 1] }, { $ifNull: ["$quantity", 0] }],
          },
        },
        weight: { $sum: { $ifNull: ["$grossWeight", "$weight"] } },
      },
    },
    {
      $project: {
        _id: 0,
        metalType: "$_id.metalType",
        tagNumber: { $cond: [{ $eq: ["$_id.stockType", "TAG"] }, "MULTIPLE", "-"] },
        stockType: "$_id.stockType",
        category: "$_id.category",
        categoryCode: "$_id.categoryCode",
        pieces: 1,
        weight: { $round: ["$weight", 3] },
      },
    },
  ]);

  const inwardRows = await SaleTransaction.aggregate([
    ...(Object.keys(inwardRootMatch(query)).length ? [{ $match: inwardRootMatch(query) }] : []),
    { $unwind: "$receivedItems" },
    { $match: { "receivedItems.isCancelled": { $ne: true } } },
    ...(Object.keys(inwardItemMatch(query)).length ? [{ $match: inwardItemMatch(query) }] : []),
    {
      $group: {
        _id: {
          metalType: "$receivedItems.metalType",
          stockType: "$receivedItems.itemType",
          category: "$receivedItems.category",
          purity: "$receivedItems.purity",
        },
        pieces: { $sum: 1 },
        weight: { $sum: "$receivedItems.weight" },
      },
    },
    {
      $project: {
        _id: 0,
        metalType: "$_id.metalType",
        tagNumber: "-",
        stockType: "$_id.stockType",
        category: "$_id.category",
        categoryCode: "$_id.purity",
        pieces: 1,
        weight: { $round: ["$weight", 3] },
      },
    },
  ]);

  return sortReportRows([...inventoryRows, ...inwardRows]);
};

const getStockDetailedRows = async (query = {}) => {
  const inventoryRows = await Inventory.aggregate([
    { $match: inventoryMatch(query) },
    {
      $project: {
        _id: 0,
        date: { $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" } },
        metalType: 1,
        tagNumber: { $cond: [{ $eq: ["$stockType", "TAG"] }, { $toString: "$tagId" }, "-"] },
        stockType: 1,
        category: 1,
        categoryCode: 1,
        pieces: { $cond: [{ $eq: ["$stockType", "TAG"] }, { $ifNull: ["$pieces", 1] }, { $ifNull: ["$quantity", 0] }] },
        weight: { $round: [{ $ifNull: ["$grossWeight", "$weight"] }, 3] },
        seller: "$sellerName",
        status: 1,
      },
    },
  ]);

  const inwardRows = await SaleTransaction.aggregate([
    ...(Object.keys(inwardRootMatch(query)).length ? [{ $match: inwardRootMatch(query) }] : []),
    { $unwind: "$receivedItems" },
    { $match: { "receivedItems.isCancelled": { $ne: true } } },
    ...(Object.keys(inwardItemMatch(query)).length ? [{ $match: inwardItemMatch(query) }] : []),
    {
      $project: {
        _id: 0,
        date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        saleId: 1,
        customer: "$customerName",
        metalType: "$receivedItems.metalType",
        tagNumber: "-",
        stockType: "$receivedItems.itemType",
        category: "$receivedItems.category",
        categoryCode: "$receivedItems.purity",
        pieces: { $literal: 1 },
        weight: { $round: ["$receivedItems.weight", 3] },
        status: { $literal: "INWARD" },
      },
    },
  ]);

  return sortReportRows([...inventoryRows, ...inwardRows]);
};

const salesGroupExpression = (groupBy) => {
  if (groupBy === "customer") return "$customerName";
  if (groupBy === "item") return "$items.category";
  return { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
};

const salesGroupLabel = (groupBy) => {
  if (groupBy === "customer") return "customer";
  if (groupBy === "item") return "item";
  return "date";
};

const salesSummaryPipeline = (query = {}) => {
  const groupBy = query.groupBy || "date";
  const label = salesGroupLabel(groupBy);

  return [
    ...transactionMatchStages(query, "sales"),
    {
      $group: {
        _id: { label: salesGroupExpression(groupBy), metalType: "$items.metalType", status: "$status" },
        quantity: { $sum: "$items.quantity" },
        grossWeight: { $sum: "$items.weight" },
        stoneWeight: { $sum: "$items.stoneWeight" },
        transactionCount: { $addToSet: "$_id" },
      },
    },
    {
      $project: {
        _id: 0,
        [label]: "$_id.label",
        metalType: "$_id.metalType",
        status: { $ifNull: ["$_id.status", "ACTIVE"] },
        quantity: 1,
        grossWeight: { $round: ["$grossWeight", 3] },
        stoneWeight: { $round: ["$stoneWeight", 3] },
        transactionCount: { $size: "$transactionCount" },
      },
    },
    { $sort: { [label]: 1 } },
  ];
};

const salesDetailedPipeline = (query = {}) => [
  ...transactionMatchStages(query, "sales"),
  {
    $project: {
      _id: 0,
      date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
      saleId: 1,
      customer: "$customerName",
      stockType: "$items.stockType",
      tagNumber: { $ifNull: [{ $toString: "$items.tagId" }, "$items.trayCode"] },
      status: {
        $cond: [
          { $ifNull: ["$items.isReturned", false] },
          "RETURNED",
          { $ifNull: ["$status", "ACTIVE"] },
        ],
      },
      metalType: "$items.metalType",
      category: "$items.category",
      categoryCode: "$items.categoryCode",
      pieces: "$items.quantity",
      weight: { $round: ["$items.weight", 3] },
      stoneWeight: { $round: ["$items.stoneWeight", 3] },
    },
  },
  { $sort: { customer: 1, date: 1, category: 1 } },
];

const getStockInwardDetailedRows = async (query = {}) => {
  const sellerItemMatch = stockInwardSellerItemMatch(query);
  const skipSellerItems = sellerItemMatch.__skipSellerItems;
  delete sellerItemMatch.__skipSellerItems;

  const sellerRows = skipSellerItems
    ? []
    : await StockTransaction.aggregate([
        ...(Object.keys(stockInwardSellerRootMatch(query)).length ? [{ $match: stockInwardSellerRootMatch(query) }] : []),
        { $unwind: "$items" },
        ...(Object.keys(sellerItemMatch).length ? [{ $match: sellerItemMatch }] : []),
        {
          $project: {
            _id: 0,
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            transactionId: 1,
            sourceType: { $literal: "SELLER" },
            source: "$sellerName",
            seller: "$sellerName",
            stockType: "$items.stockType",
            tagNumber: { $ifNull: ["$items.tagId", "$items.trayCode"] },
            metalType: "$items.metalType",
            category: "$items.category",
            categoryCode: "$items.categoryCode",
            pieces: "$items.quantity",
            weight: { $round: ["$items.weight", 3] },
            stoneWeight: { $round: ["$items.stoneWeight", 3] },
          },
        },
      ]);

  const customerRows = await SaleTransaction.aggregate([
    ...(Object.keys(inwardRootMatch(query)).length ? [{ $match: inwardRootMatch(query) }] : []),
    { $unwind: "$receivedItems" },
    { $match: { "receivedItems.isCancelled": { $ne: true } } },
    ...(Object.keys(inwardItemMatch(query)).length ? [{ $match: inwardItemMatch(query) }] : []),
    {
      $project: {
        _id: 0,
        date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        saleId: 1,
        sourceType: { $literal: "CUSTOMER" },
        source: "$customerName",
        seller: { $literal: "CUSTOMER RETURNS" },
        stockType: "$receivedItems.itemType",
        metalType: "$receivedItems.metalType",
        category: "$receivedItems.category",
        pieces: { $literal: 1 },
        weight: { $round: ["$receivedItems.weight", 3] },
        purity: "$receivedItems.purity",
      },
    },
  ]);

  return sortReportRows([...sellerRows, ...customerRows]);
};

const getStockInwardSummaryRows = async (query = {}) => {
  const rows = await getStockInwardDetailedRows(query);
  const groupBy = query.groupBy || "seller-date";
  const groups = new Map();

  rows.forEach((row) => {
    let key;
    let groupObj;

    if (groupBy === "seller-date") {
      const seller = row.sourceType === "SELLER" ? row.source : "CUSTOMER RETURNS";
      const date = row.date;
      key = [seller || "-", date || "-", row.metalType || "-", row.stockType || "-"].join("|");
      groupObj = {
        seller: seller,
        date: date,
        metalType: row.metalType,
        stockType: row.stockType,
        pieces: 0,
        weight: 0,
        stoneWeight: 0,
        transactionCount: 0,
      };
    } else if (groupBy === "source") {
      const label = row.source;
      key = [label || "-", row.metalType || "-", row.stockType || "-"].join("|");
      groupObj = {
        source: label,
        metalType: row.metalType,
        stockType: row.stockType,
        pieces: 0,
        weight: 0,
        stoneWeight: 0,
        transactionCount: 0,
      };
    } else if (groupBy === "item") {
      const label = row.category;
      key = [label || "-", row.metalType || "-", row.stockType || "-"].join("|");
      groupObj = {
        item: label,
        metalType: row.metalType,
        stockType: row.stockType,
        pieces: 0,
        weight: 0,
        stoneWeight: 0,
        transactionCount: 0,
      };
    } else {
      const label = row.date;
      key = [label || "-", row.metalType || "-", row.stockType || "-"].join("|");
      groupObj = {
        date: label,
        metalType: row.metalType,
        stockType: row.stockType,
        pieces: 0,
        weight: 0,
        stoneWeight: 0,
        transactionCount: 0,
      };
    }

    const current = groups.get(key) || groupObj;
    current.pieces += Number(row.pieces || 0);
    current.weight = round(current.weight + Number(row.weight || 0));
    current.stoneWeight = round(current.stoneWeight + Number(row.stoneWeight || 0));
    current.transactionCount += 1;
    groups.set(key, current);
  });

  return sortReportRows(Array.from(groups.values()));
};

const getStockReport = async (query = {}) => {
  const reportType = query.reportType || DEFAULT_REPORT_TYPE.stock;
  const rows = reportType === "stock-detailed" ? await getStockDetailedRows(query) : await getStockSummaryRows(query);
  return buildReportResponse("stock", reportType, query, rows);
};

const getSalesReport = async (query = {}) => {
  const reportType = query.reportType || DEFAULT_REPORT_TYPE.sales;

  if (reportType === "cancelled-sales") {
    return getCancelledSalesReport(query);
  }

  const pipeline = reportType === "sales-detailed" ? salesDetailedPipeline(query) : salesSummaryPipeline(query);
  const rows = await SaleTransaction.aggregate(pipeline);
  return buildReportResponse("sales", reportType, query, rows);
};

const getStockInwardReport = async (query = {}) => {
  const reportType = query.reportType || DEFAULT_REPORT_TYPE.stockInward;
  const rows = reportType === "stock-inward-detailed" ? await getStockInwardDetailedRows(query) : await getStockInwardSummaryRows(query);
  return buildReportResponse("stockInward", reportType, query, rows);
};

const getCancelledSalesReport = async (query = {}) => {
  const match = { status: "CANCELLED" };
  const dateRange = toDateRange({ fromDate: query.fromDate, toDate: query.toDate });
  if (dateRange) match.cancelledAt = dateRange;
  if (query.stockType) match.stockType = query.stockType;

  const rows = await Sale.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "inventories",
        localField: "inventory",
        foreignField: "_id",
        as: "inventory",
      },
    },
    { $unwind: { path: "$inventory", preserveNullAndEmptyArrays: true } },
    ...(query.metalType ? [{ $match: { "inventory.metalType": query.metalType } }] : []),
    ...(query.category ? [{ $match: { "inventory.category": textRegex(query.category) } }] : []),
    {
      $project: {
        _id: 0,
        saleDate: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
        cancelledAt: { $dateToString: { format: "%Y-%m-%d", date: "$cancelledAt" } },
        stockType: 1,
        tagId: 1,
        metalType: "$inventory.metalType",
        category: "$inventory.category",
        quantity: { $literal: 1 },
        grossWeight: { $ifNull: ["$inventory.grossWeight", "$inventory.weight"] },
        stoneWeight: { $ifNull: ["$inventory.stoneWeight", 0] },
        reason: "$cancelReason",
      },
    },
    { $sort: { cancelledAt: -1 } },
  ]);

  return buildReportResponse("sales", "cancelled-sales", query, rows);
};

const inventoryMatchStages = (query = {}, forcedStatus = null) => {
  const match = { isDeleted: { $ne: true } };
  if (forcedStatus) match.status = forcedStatus;
  if (query.metalType) match.metalType = query.metalType;
  if (query.category) match.category = textRegex(query.category);
  if (query.seller) match.sellerName = textRegex(query.seller);
  if (query.stockType) match.stockType = query.stockType;
  return [{ $match: match }];
};

const getInventoryReport = async (query = {}) => {
  const reportType = query.reportType || DEFAULT_REPORT_TYPE.inventory;
  const forcedStatus = reportType === "available-stock" ? "AVAILABLE" : reportType === "sold-stock" ? "SOLD" : null;
  let pipeline;

  if (reportType === "stone-weight") {
    pipeline = [
      ...inventoryMatchStages(query, forcedStatus),
      {
        $group: {
          _id: { stockType: "$stockType", metalType: "$metalType", category: "$category" },
          quantity: { $sum: { $cond: [{ $eq: ["$stockType", "TAG"] }, { $ifNull: ["$pieces", 1] }, { $ifNull: ["$quantity", 0] }] } },
          grossWeight: { $sum: { $ifNull: ["$grossWeight", "$weight"] } },
          stoneWeight: { $sum: { $ifNull: ["$stoneWeight", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          stockType: "$_id.stockType",
          metalType: "$_id.metalType",
          category: "$_id.category",
          quantity: 1,
          grossWeight: { $round: ["$grossWeight", 3] },
          stoneWeight: { $round: ["$stoneWeight", 3] },
        },
      },
      { $sort: { stoneWeight: -1 } },
    ];
  } else {
    pipeline = [
      ...inventoryMatchStages(query, forcedStatus),
      {
        $project: {
          _id: 0,
          stockType: 1,
          identifier: { $cond: [{ $eq: ["$stockType", "TAG"] }, { $toString: "$tagId" }, { $ifNull: ["$trayCode", "$trayName"] }] },
          metalType: 1,
          category: 1,
          categoryCode: 1,
          seller: "$sellerName",
          status: 1,
          quantity: { $cond: [{ $eq: ["$stockType", "TAG"] }, { $ifNull: ["$pieces", 1] }, { $ifNull: ["$quantity", 0] }] },
          grossWeight: { $round: [{ $ifNull: ["$grossWeight", "$weight"] }, 3] },
          stoneWeight: { $round: [{ $ifNull: ["$stoneWeight", 0] }, 3] },
        },
      },
      { $sort: { stockType: 1, category: 1, identifier: 1 } },
    ];
  }

  const rows = await Inventory.aggregate(pipeline);
  return buildReportResponse("inventory", reportType, query, rows);
};

const getCustomerLookups = async (query = {}) => {
  const match = {};

  if (query.search) {
    match.customerName = textRegex(query.search);
  }

  const rows = await SaleTransaction.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    { $group: { _id: "$customerName" } },
    { $project: { _id: 0, name: "$_id" } },
    { $sort: { name: 1 } },
    { $limit: 100 },
  ]);

  return rows;
};

const buildReportResponse = (section, reportType, query, rows) => ({
  section,
  reportType,
  title: REPORT_TITLES[reportType] || REPORT_TITLES[DEFAULT_REPORT_TYPE[section]],
  filters: cleanFilters({ ...query, reportType }),
  rows: sortReportRows(rows),
  totals: totalsFromRows(rows),
});

module.exports = {
  getCustomerLookups,
  getInventoryReport,
  getSalesReport,
  getStockInwardReport,
  getStockReport,
  REPORT_TITLES,
};
