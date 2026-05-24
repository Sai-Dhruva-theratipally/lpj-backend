const Admin = require("../models/Admin");
const asyncHandler = require("../middleware/asyncHandler");
const generateToken = require("../utils/generateToken");
const { sendSuccess } = require("../utils/apiResponse");

const loginAdmin = asyncHandler(async (req, res) => {
  const username = req.body.username.toLowerCase();
  const { password } = req.body;

  const admin = await Admin.findOne({ username }).select("+password");

  if (!admin || !(await admin.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid username or password");
  }

  const token = generateToken(admin._id);

  return sendSuccess(res, 200, "Login successful", {
    token,
    admin: {
      id: admin._id,
      username: admin.username,
    },
  });
});

const getCurrentAdmin = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, "Admin profile fetched", {
    admin: {
      id: req.admin._id,
      username: req.admin.username,
    },
  });
});

module.exports = { loginAdmin, getCurrentAdmin };
