const express = require("express");
const trayInventoryController = require("../controllers/trayInventoryController");
const { protect } = require("../middleware/authMiddleware");
const {
  bulkCreateTrayValidation,
  bulkStockChangeValidation,
  createTrayValidation,
  listTrayValidation,
  mongoIdParam,
  saleItemsValidation,
  stockAdditionValidation,
  stockChangeByIdentifierValidation,
  stockChangeValidation,
  updateTrayValidation,
} = require("../validations/trayInventoryValidation");

const router = express.Router();

router.use(protect);

router
  .route("/")
  .post(createTrayValidation, trayInventoryController.createTray)
  .get(listTrayValidation, trayInventoryController.getTrays);

router.post("/bulk", bulkCreateTrayValidation, trayInventoryController.createMultipleTrays);
router.patch("/add-stock", stockChangeByIdentifierValidation, trayInventoryController.addTrayStockByIdentifier);
router.patch("/sell", saleItemsValidation, trayInventoryController.sellMultipleFromTrays);
router.patch("/bulk/add-stock", bulkStockChangeValidation, trayInventoryController.addStockToMultipleTrays);

router
  .route("/:id")
  .get(mongoIdParam, trayInventoryController.getTrayById)
  .patch(updateTrayValidation, trayInventoryController.updateTray);

router.patch("/:id/add-stock", stockAdditionValidation, trayInventoryController.addTrayStock);
router.patch("/:id/reduce-stock", stockChangeValidation, trayInventoryController.reduceTrayStock);
router.patch("/:id/sell", stockChangeValidation, trayInventoryController.sellFromTray);

module.exports = router;
