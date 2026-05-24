const Counter = require("../models/Counter");
const Inventory = require("../models/Inventory");
const { TAG_CODE_END, TAG_CODE_START } = require("./tagCodeConstants");

const getNextTagCode = async () => {
  const counter = await Counter.findOneAndUpdate(
    { _id: "tagId", seq: { $gte: TAG_CODE_START, $lt: TAG_CODE_END } },
    { $inc: { seq: 1 } },
    { new: true }
  );

  if (counter) {
    return counter.seq;
  }

  const highestTag = await Inventory.findOne({
    stockType: "TAG",
    tagId: { $gte: TAG_CODE_START, $lte: TAG_CODE_END },
  })
    .sort({ tagId: -1 })
    .select("tagId");
  const nextCode = highestTag ? highestTag.tagId + 1 : TAG_CODE_START;

  if (nextCode > TAG_CODE_END) {
    const error = new Error("No 12 digit tag codes are available");
    error.statusCode = 500;
    throw error;
  }

  const resetCounter = await Counter.findOneAndUpdate(
    { _id: "tagId" },
    { $set: { seq: nextCode } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return resetCounter.seq;
};

module.exports = {
  TAG_CODE_END,
  TAG_CODE_START,
  getNextTagCode,
};
