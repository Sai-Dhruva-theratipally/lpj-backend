const Inventory = require("../models/Inventory");
const Sale = require("../models/Sale");
const SaleTransaction = require("../models/SaleTransaction");
const StockTransaction = require("../models/StockTransaction");

const REPORT_TITLES = {
  "daily-stock-addition": "Daily Stock Addition Report",
  "seller-wise-stock": "Seller-wise Stock Report",
  "metal-wise-stock": "Metal-wise Stock Report",
  "category-wise-stock": "Category-wise Stock Report",
  "tag-vs-tray-stock": "Tag vs Tray Stock Report",
  "daily-sales": "Daily Sales Report",
  "customer-wise-sales": "Customer-wise Sales Report",
  "category-wise-sales": "Category-wise Sales Report",
  "metal-wise-sales": "Gold vs Silver Sales Report",
  "tag-vs-tray-sales": "Tag vs Tray Sales Report",
  "monthly-sales-summary": "Monthly Sales Summary",
  "cancelled-sales": "Cancelled Sales Report",
  "current-inventory": "Current Inventory Report",
  "available-stock": "Available Stock Report",
  "sold-stock": "Sold Stock Report",
  "stone-weight": "Stone Weight Report",
};

const DEFAULT_REPORT_TYPE = {
  stock: "daily-stock-addition",
  sales: "daily-sales",
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
  stockType: query.stockType || "",
  reportType: query.reportType || "",
});

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const textRegex = (value) => new RegExp(escapeRegex(String(value).trim().toUpperCase()));

const round = (value) => Number((Number(value || 0)).toFixed(3));

const totalsFromRows = (rows) => ({
  quantity: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
  grossWeight: round(rows.reduce((sum, row) => sum + Number(row.grossWeight || 0), 0)),
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

const getStockReport = async (query = {}) => {
  const reportType = query.reportType || DEFAULT_REPORT_TYPE.stock;
  const base = transactionMatchStages(query, "stock");
  let pipeline;

  if (reportType === "seller-wise-stock") {
    pipeline = [...base, ...groupTransactionBy("$sellerName", "seller")];
  } else if (reportType === "metal-wise-stock") {
    pipeline = [...base, ...groupTransactionBy("$items.metalType", "metalType")];
  } else if (reportType === "category-wise-stock") {
    pipeline = [...base, ...groupTransactionBy("$items.category", "category")];
  } else if (reportType === "tag-vs-tray-stock") {
    pipeline = [...base, ...groupTransactionBy("$items.stockType", "stockType")];
  } else {
    pipeline = [
      ...base,
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          transactionId: 1,
          seller: "$sellerName",
          stockType: "$items.stockType",
          metalType: "$items.metalType",
          category: "$items.category",
          categoryCode: "$items.categoryCode",
          quantity: "$items.quantity",
          grossWeight: { $round: ["$items.weight", 3] },
          stoneWeight: { $round: ["$items.stoneWeight", 3] },
        },
      },
      { $sort: { date: -1, transactionId: 1 } },
    ];
  }

  const rows = await StockTransaction.aggregate(pipeline);
  return buildReportResponse("stock", reportType, query, rows);
};

const getSalesReport = async (query = {}) => {
  const reportType = query.reportType || DEFAULT_REPORT_TYPE.sales;

  if (reportType === "cancelled-sales") {
    return getCancelledSalesReport(query);
  }

  const base = transactionMatchStages(query, "sales");
  let pipeline;

  if (reportType === "customer-wise-sales") {
    pipeline = [...base, ...groupTransactionBy("$customerName", "customer")];
  } else if (reportType === "category-wise-sales") {
    pipeline = [...base, ...groupTransactionBy("$items.category", "category")];
  } else if (reportType === "metal-wise-sales") {
    pipeline = [...base, ...groupTransactionBy("$items.metalType", "metalType")];
  } else if (reportType === "tag-vs-tray-sales") {
    pipeline = [...base, ...groupTransactionBy("$items.stockType", "stockType")];
  } else if (reportType === "monthly-sales-summary") {
    pipeline = [
      ...base,
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          quantity: { $sum: "$items.quantity" },
          grossWeight: { $sum: "$items.weight" },
          stoneWeight: { $sum: "$items.stoneWeight" },
          transactions: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              { $cond: [{ $lt: ["$_id.month", 10] }, { $concat: ["0", { $toString: "$_id.month" }] }, { $toString: "$_id.month" }] },
            ],
          },
          quantity: 1,
          grossWeight: { $round: ["$grossWeight", 3] },
          stoneWeight: { $round: ["$stoneWeight", 3] },
          transactionCount: { $size: "$transactions" },
        },
      },
      { $sort: { month: -1 } },
    ];
  } else {
    pipeline = [
      ...base,
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          saleId: 1,
          customer: "$customerName",
          stockType: "$items.stockType",
          metalType: "$items.metalType",
          category: "$items.category",
          categoryCode: "$items.categoryCode",
          quantity: "$items.quantity",
          grossWeight: { $round: ["$items.weight", 3] },
          stoneWeight: { $round: ["$items.stoneWeight", 3] },
        },
      },
      { $sort: { date: -1, saleId: 1 } },
    ];
  }

  const rows = await SaleTransaction.aggregate(pipeline);
  return buildReportResponse("sales", reportType, query, rows);
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
  rows,
  totals: totalsFromRows(rows),
});

module.exports = {
  getCustomerLookups,
  getInventoryReport,
  getSalesReport,
  getStockReport,
  REPORT_TITLES,
};
