const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const corsOptions = require("./config/corsOptions");
const aiRoutes = require("./routes/aiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const documentRoutes = require("./routes/documentRoutes");
const inventoryTransactionRoutes = require("./routes/inventoryTransactionRoutes");
const metalRateRoutes = require("./routes/metalRateRoutes");
const manualRateRoutes = require("./routes/manualRateRoutes");
const printRoutes = require("./routes/printRoutes");
const reportRoutes = require("./routes/reportRoutes");
const sellerRoutes = require("./routes/sellerRoutes");
const tagInventoryRoutes = require("./routes/tagInventoryRoutes");
const trayInventoryRoutes = require("./routes/trayInventoryRoutes");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LPJ backend running",
  });
});

app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/inventory", inventoryTransactionRoutes);
app.use("/api/inventory/tags", tagInventoryRoutes);
app.use("/api/inventory/trays", trayInventoryRoutes);
app.use("/api/metal-rates", metalRateRoutes);
app.use("/api/manual-rates", manualRateRoutes);
app.use("/api/print", printRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/sellers", sellerRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
