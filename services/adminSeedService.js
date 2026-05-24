const Admin = require("../models/Admin");

const seedDefaultAdmin = async () => {
  const username = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "11032005";

  const existingAdmin = await Admin.findOne({ username });

  if (existingAdmin) {
    return;
  }

  await Admin.create({ username, password });
  console.log(`Default admin created: ${username}`);
};

module.exports = seedDefaultAdmin;
