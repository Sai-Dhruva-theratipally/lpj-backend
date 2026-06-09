const Counter = require("../models/Counter");

const UNIQUE_NUMBER_START = 1;
const UNIQUE_NUMBER_END = 99999;

const normalizeCategoryCodePrefix = (categoryCode) =>
  String(categoryCode || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(6, "X")
    .slice(0, 6);

const getNextTagCode = async (categoryCode) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: "tagUniqueNumber", seq: { $gte: UNIQUE_NUMBER_START, $lt: UNIQUE_NUMBER_END } },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  if (!counter || counter.seq > UNIQUE_NUMBER_END) {
    const error = new Error("No 5 digit tag unique numbers are available");
    error.statusCode = 500;
    throw error;
  }

  return `${normalizeCategoryCodePrefix(categoryCode)}${String(counter.seq).padStart(5, "0")}`;
};

module.exports = {
  getNextTagCode,
  normalizeCategoryCodePrefix,
};
