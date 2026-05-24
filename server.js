require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const seedDefaultAdmin = require("./services/adminSeedService");
const { ensureRatesExist, startMetalRateScheduler } = require("./services/metalRateService");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedDefaultAdmin();
    await ensureRatesExist();
    startMetalRateScheduler();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
