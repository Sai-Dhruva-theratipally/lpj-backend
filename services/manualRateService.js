const ManualRate = require("../models/ManualRate");
const StockTransaction = require("../models/StockTransaction");
const SaleTransaction = require("../models/SaleTransaction");

// Get latest rates for all metal types and rate types
const getLatestRates = async () => {
  const metalTypes = ["GOLD", "SILVER"];
  const rateTypes = ["BUY", "SELL"];
  
  const rates = {};
  
  for (const metalType of metalTypes) {
    rates[metalType] = {};
    for (const rateType of rateTypes) {
      const latestRate = await ManualRate.findOne({
        metalType,
        rateType,
      })
        .sort({ createdAt: -1 })
        .lean();
      
      rates[metalType][rateType] = latestRate ? latestRate.rate : 0;
    }
  }
  
  return rates;
};

// Get latest rate for specific metal and type
const getLatestRate = async (metalType, rateType) => {
  const rate = await ManualRate.findOne({
    metalType,
    rateType,
  })
    .sort({ createdAt: -1 })
    .lean();
  
  return rate ? rate.rate : 0;
};

// Record a rate (from transaction or manual entry)
const recordRate = async (metalType, rateType, rate, options = {}) => {
  if (!rate || rate < 0) {
    return null;
  }

  const manualRate = await ManualRate.create({
    metalType,
    rateType,
    rate,
    recordedBy: options.recordedBy || "SYSTEM",
    source: options.source || "MANUAL_ENTRY",
    transactionId: options.transactionId || undefined,
    transactionType: options.transactionType || undefined,
  });

  return manualRate;
};

const buildCreatedAtRange = (query = {}) => {
  const range = {};

  if (query.fromDate) {
    range.$gte = new Date(query.fromDate);
  }

  if (query.toDate) {
    const end = new Date(query.toDate);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  return Object.keys(range).length > 0 ? range : null;
};

const mapRateHistoryRows = (transactions, transactionType) => {
  return transactions.map((transaction) => ({
    id: `${transactionType}-${transaction._id}`,
    transactionType,
    dateTime: transaction.createdAt || transaction.date,
    goldBought: Number(transaction.rates?.goldBuyRate || 0),
    goldSold: Number(transaction.rates?.goldSellRate || 0),
    silverBought: Number(transaction.rates?.silverBuyRate || 0),
    silverSold: Number(transaction.rates?.silverSellRate || 0),
  }));
};

// Get rate history with filters
const getRateHistory = async (query = {}) => {
  const createdAtRange = buildCreatedAtRange(query);
  const match = createdAtRange ? { createdAt: createdAtRange } : {};

  const [stockTransactions, saleTransactions] = await Promise.all([
    StockTransaction.find(match).select("rates createdAt date").sort({ createdAt: -1 }).lean(),
    SaleTransaction.find(match).select("rates createdAt date").sort({ createdAt: -1 }).lean(),
  ]);

  const metalType = query.metalType ? query.metalType.toUpperCase() : "";
  const rows = [...mapRateHistoryRows(stockTransactions, "STOCK"), ...mapRateHistoryRows(saleTransactions, "SALE")].filter(
    (row) => {
      if (metalType === "GOLD") {
        return row.goldBought > 0 || row.goldSold > 0;
      }

      if (metalType === "SILVER") {
        return row.silverBought > 0 || row.silverSold > 0;
      }

      return row.goldBought > 0 || row.goldSold > 0 || row.silverBought > 0 || row.silverSold > 0;
    }
  );

  return rows.sort((first, second) => new Date(second.dateTime) - new Date(first.dateTime));
};

// Save rates from a transaction
const saveTransactionRates = async (transactionId, transactionType, rates = {}) => {
  const rateEntries = [];

  if (rates.goldBuyRate && rates.goldBuyRate > 0) {
    rateEntries.push({
      metalType: "GOLD",
      rateType: "BUY",
      rate: rates.goldBuyRate,
      source: transactionType === "StockTransaction" ? "STOCK_TRANSACTION" : "SALE_TRANSACTION",
      transactionId,
      transactionType,
    });
  }

  if (rates.goldSellRate && rates.goldSellRate > 0) {
    rateEntries.push({
      metalType: "GOLD",
      rateType: "SELL",
      rate: rates.goldSellRate,
      source: transactionType === "StockTransaction" ? "STOCK_TRANSACTION" : "SALE_TRANSACTION",
      transactionId,
      transactionType,
    });
  }

  if (rates.silverBuyRate && rates.silverBuyRate > 0) {
    rateEntries.push({
      metalType: "SILVER",
      rateType: "BUY",
      rate: rates.silverBuyRate,
      source: transactionType === "StockTransaction" ? "STOCK_TRANSACTION" : "SALE_TRANSACTION",
      transactionId,
      transactionType,
    });
  }

  if (rates.silverSellRate && rates.silverSellRate > 0) {
    rateEntries.push({
      metalType: "SILVER",
      rateType: "SELL",
      rate: rates.silverSellRate,
      source: transactionType === "StockTransaction" ? "STOCK_TRANSACTION" : "SALE_TRANSACTION",
      transactionId,
      transactionType,
    });
  }

  if (rateEntries.length > 0) {
    await ManualRate.insertMany(rateEntries);
  }

  return rateEntries;
};

module.exports = {
  getLatestRates,
  getLatestRate,
  recordRate,
  getRateHistory,
  saveTransactionRates,
};
