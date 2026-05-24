const Seller = require("../models/Seller");

const normalizeSellerKey = (name) => name.trim().toLowerCase();

const getSellers = async (query = {}) => {
  const filters = {};

  if (query.search) {
    filters.name = new RegExp(query.search, "i");
  }

  return Seller.find(filters).sort({ name: 1 });
};

const findOrCreateSeller = async (name) => {
  const trimmedName = name.trim();
  const nameKey = normalizeSellerKey(trimmedName);

  const seller = await Seller.findOne({ nameKey });

  if (seller) {
    return seller;
  }

  return Seller.create({ name: trimmedName, nameKey });
};

module.exports = {
  findOrCreateSeller,
  getSellers,
};
