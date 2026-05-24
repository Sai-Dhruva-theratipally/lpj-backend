const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const Inventory = require("../models/Inventory");
const Sale = require("../models/Sale");
const SaleTransaction = require("../models/SaleTransaction");
const StockTransaction = require("../models/StockTransaction");
const seedDefaultAdmin = require("./adminSeedService");

const resetDatabase = async (adminId, password) => {
  if (process.env.NODE_ENV === "production" && process.env.RESET_DATABASE_ENABLED !== "true") {
    const error = new Error("Database reset is disabled in production");
    error.statusCode = 403;
    throw error;
  }

  const admin = await Admin.findById(adminId).select("+password");

  if (!admin || !(await admin.matchPassword(password))) {
    const error = new Error("Password is incorrect");
    error.statusCode = 401;
    throw error;
  }

  await mongoose.connection.db.dropDatabase();
  await seedDefaultAdmin();

  return {
    reset: true,
    defaultAdminRecreated: true,
  };
};

const resetStock = async (adminId, password, stockType = "ALL") => {
  if (process.env.NODE_ENV === "production" && process.env.RESET_DATABASE_ENABLED !== "true") {
    const error = new Error("Stock reset is disabled in production");
    error.statusCode = 403;
    throw error;
  }

  const admin = await Admin.findById(adminId).select("+password");

  if (!admin || !(await admin.matchPassword(password))) {
    const error = new Error("Password is incorrect");
    error.statusCode = 401;
    throw error;
  }

  const normalizedStockType = stockType === "ALL" ? undefined : stockType;
  const inventoryFilter = normalizedStockType ? { stockType: normalizedStockType } : {};
  const saleFilter = normalizedStockType ? { stockType: normalizedStockType } : {};

  const [inventoryResult, saleResult, saleTransactionResult, stockTransactionResult] = await Promise.all([
    Inventory.deleteMany(inventoryFilter),
    Sale.deleteMany(saleFilter),
    SaleTransaction.deleteMany(saleFilter),
    StockTransaction.deleteMany(normalizedStockType ? { "items.stockType": normalizedStockType } : {}),
  ]);

  return {
    reset: true,
    stockType: stockType || "ALL",
    inventoryDeleted: inventoryResult.deletedCount,
    salesDeleted: saleResult.deletedCount,
    saleTransactionsDeleted: saleTransactionResult.deletedCount,
    stockTransactionsDeleted: stockTransactionResult.deletedCount,
  };
};

module.exports = { resetDatabase, resetStock };
