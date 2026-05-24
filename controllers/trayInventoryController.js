const asyncHandler = require("../middleware/asyncHandler");
const trayInventoryService = require("../services/trayInventoryService");
const { sendSuccess } = require("../utils/apiResponse");

const createTray = asyncHandler(async (req, res) => {
  const tray = await trayInventoryService.createTray(req.body);
  return sendSuccess(res, 201, "Tray created successfully", tray);
});

const createMultipleTrays = asyncHandler(async (req, res) => {
  const result = await trayInventoryService.createMultipleTrays(req.body.items);
  return sendSuccess(res, 201, "Bulk tray creation completed", result);
});

const getTrays = asyncHandler(async (req, res) => {
  const trays = await trayInventoryService.getTrays(req.query);
  return sendSuccess(res, 200, "Trays fetched successfully", trays);
});

const getTrayById = asyncHandler(async (req, res) => {
  const tray = await trayInventoryService.getTrayById(req.params.id);
  return sendSuccess(res, 200, "Tray fetched successfully", tray);
});

const updateTray = asyncHandler(async (req, res) => {
  const tray = await trayInventoryService.updateTray(req.params.id, req.body);
  return sendSuccess(res, 200, "Tray updated successfully", tray);
});

const addTrayStock = asyncHandler(async (req, res) => {
  const tray = await trayInventoryService.addTrayStock(req.params.id, req.body);
  return sendSuccess(res, 200, "Tray stock added successfully", tray);
});

const addTrayStockByIdentifier = asyncHandler(async (req, res) => {
  const tray = await trayInventoryService.addTrayStockByIdentifier(req.body);
  return sendSuccess(res, 200, "Tray stock added successfully", tray);
});

const addStockToMultipleTrays = asyncHandler(async (req, res) => {
  const result = await trayInventoryService.addStockToMultipleTrays(req.body.items);
  return sendSuccess(res, 200, "Bulk tray stock update completed", result);
});

const reduceTrayStock = asyncHandler(async (req, res) => {
  const tray = await trayInventoryService.reduceTrayStock(req.params.id, req.body);
  return sendSuccess(res, 200, "Tray stock reduced successfully", tray);
});

const sellFromTray = asyncHandler(async (req, res) => {
  const tray = await trayInventoryService.sellFromTray(req.params.id, req.body);
  return sendSuccess(res, 200, "Tray sale completed successfully", tray);
});

const sellMultipleFromTrays = asyncHandler(async (req, res) => {
  const result = await trayInventoryService.sellMultipleFromTrays(req.body.items);
  return sendSuccess(res, 200, "Tray sale completed successfully", result);
});

module.exports = {
  addStockToMultipleTrays,
  addTrayStock,
  addTrayStockByIdentifier,
  createTray,
  createMultipleTrays,
  getTrayById,
  getTrays,
  reduceTrayStock,
  sellFromTray,
  sellMultipleFromTrays,
  updateTray,
};
