const asyncHandler = require("../middleware/asyncHandler");
const metalRateService = require("../services/metalRateService");

const getMetalRates = asyncHandler(async (req, res) => {
  const rates = await metalRateService.getLatestRates();

  if (!rates) {
    return res.status(200).json({
      goldRate: null,
      silverRate: null,
      updatedAt: null,
    });
  }

  return res.status(200).json({
    goldRate: rates.goldRate,
    silverRate: rates.silverRate,
    updatedAt: rates.updatedAt,
  });
});

module.exports = { getMetalRates };
