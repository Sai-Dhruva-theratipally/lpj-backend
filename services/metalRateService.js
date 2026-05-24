const cron = require("node-cron");
const MetalRate = require("../models/MetalRate");

const TROY_OUNCE_IN_GRAMS = 31.1034768;
const SUPPORTED_METALS = new Set(["gold", "silver"]);
const DEFAULT_CRON_TIMEZONE = "Asia/Kolkata";

const buildSpotUrl = (metalType) => {
  return `https://api.metals.dev/v1/metal/spot?api_key=${process.env.METALS_API_KEY}&metal=${metalType}&currency=INR`;
};

const assertApiKey = () => {
  if (!process.env.METALS_API_KEY) {
    throw new Error("METALS_API_KEY is missing from environment variables");
  }
};

const normalizeMetalType = (metalType) => {
  const normalized = String(metalType || "").trim().toLowerCase();

  if (!SUPPORTED_METALS.has(normalized)) {
    throw new Error(`Unsupported metal type: ${metalType}`);
  }

  return normalized;
};

const parseRateResponse = (data, metalType) => {
  if (!data || data.status !== "success") {
    throw new Error(data?.error_message || `Failed to fetch ${metalType} rate`);
  }

  if (data.currency !== "INR") {
    throw new Error(`Unexpected currency for ${metalType}: ${data.currency || "unknown"}`);
  }

  if (data.metal !== metalType) {
    throw new Error(`Unexpected metal in response: ${data.metal || "unknown"}`);
  }

  const pricePerTroyOunce = Number(data.rate?.price);

  if (!Number.isFinite(pricePerTroyOunce) || pricePerTroyOunce <= 0) {
    throw new Error(`Invalid ${metalType} rate received from Metals.Dev`);
  }

  return Number((pricePerTroyOunce / TROY_OUNCE_IN_GRAMS).toFixed(2));
};

async function fetchMetalRate(metalType) {
  assertApiKey();

  const normalizedMetalType = normalizeMetalType(metalType);
  const url = buildSpotUrl(normalizedMetalType);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Unable to parse ${normalizedMetalType} rate response`);
  }

  if (!response.ok) {
    throw new Error(data?.error_message || `Metals.Dev returned ${response.status} for ${normalizedMetalType}`);
  }

  return parseRateResponse(data, normalizedMetalType);
}

const getLatestRates = async () => {
  return MetalRate.findOne().sort({ updatedAt: -1 });
};

const saveLatestRates = async ({ goldRate, silverRate }) => {
  const latestRate = await getLatestRates();
  const payload = {
    goldRate,
    silverRate,
    updatedAt: new Date(),
  };

  if (latestRate) {
    latestRate.set(payload);
    return latestRate.save();
  }

  return MetalRate.create(payload);
};

const updateLatestRates = async () => {
  const [goldRate, silverRate] = await Promise.all([fetchMetalRate("gold"), fetchMetalRate("silver")]);
  return saveLatestRates({ goldRate, silverRate });
};

const ensureRatesExist = async () => {
  const latestRate = await getLatestRates();

  if (latestRate || !process.env.METALS_API_KEY) {
    return latestRate;
  }

  try {
    return await updateLatestRates();
  } catch (error) {
    console.error(`Initial metal rate update failed: ${error.message}`);
    return null;
  }
};

const startMetalRateScheduler = () => {
  const timezone = process.env.METAL_RATE_TIMEZONE || DEFAULT_CRON_TIMEZONE;

  cron.schedule(
    "0 11 * * *",
    async () => {
      try {
        await updateLatestRates();
        console.log("Metal rates updated successfully");
      } catch (error) {
        console.error(`Scheduled metal rate update failed: ${error.message}`);
      }
    },
    { timezone }
  );

  console.log(`Metal rate scheduler started for 11:00 AM (${timezone})`);
};

module.exports = {
  ensureRatesExist,
  fetchMetalRate,
  getLatestRates,
  startMetalRateScheduler,
  updateLatestRates,
};
