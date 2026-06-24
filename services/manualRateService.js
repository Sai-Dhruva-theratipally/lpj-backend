const ManualRate = require("../models/ManualRate");

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

// Get rate history with filters
const getRateHistory = async (query = {}) => {
  const filters = {};

  if (query.metalType) {
    filters.metalType = query.metalType.toUpperCase();
  }

  if (query.rateType) {
    filters.rateType = query.rateType.toUpperCase();
  }

  if (query.source) {
    filters.source = query.source.toUpperCase();
  }

  if (query.fromDate || query.toDate) {
    filters.createdAt = {};
    if (query.fromDate) {
      filters.createdAt.$gte = new Date(query.fromDate);
    }
    if (query.toDate) {
      const end = new Date(query.toDate);
      end.setDate(end.getDate() + 1);
      filters.createdAt.$lt = end;
    }
  }

  const rates = await ManualRate.find(filters)
    .sort({ createdAt: -1 })
    .lean();

  return rates;
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
