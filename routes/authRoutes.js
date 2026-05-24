const express = require("express");
const { getCurrentAdmin, loginAdmin } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { loginValidation } = require("../validations/authValidation");

const router = express.Router();

router.post("/login", loginValidation, loginAdmin);
router.get("/me", protect, getCurrentAdmin);

module.exports = router;
