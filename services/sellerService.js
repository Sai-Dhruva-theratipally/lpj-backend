const Seller = require("../models/Seller");

const normalizeToUppercase = (name) => name.trim().toUpperCase();

const getSellers = async (query = {}) => {
  const filters = {};

  if (query.search) {
    const searchUpper = normalizeToUppercase(query.search);
    filters.name = new RegExp(searchUpper);
  }

  return Seller.find(filters).sort({ name: 1 });
};

const findOrCreateSeller = async (name) => {
  const normalizedName = normalizeToUppercase(name);

  const seller = await Seller.findOne({ name: normalizedName });

  if (seller) {
    return seller;
  }

  return Seller.create({ name: normalizedName });
};

module.exports = {
  findOrCreateSeller,
  getSellers,
};
