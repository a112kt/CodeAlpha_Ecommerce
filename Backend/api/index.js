require("dotenv").config();

const app = require("../src/app");
const connectDB = require("../src/config/db");

let isConnected = false;

const handler = async (req, res) => {
  try {
    if (!isConnected) {
      await connectDB();
      isConnected = true;
    }

    return app(req, res);
  } catch (error) {
    console.error("Serverless Function Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = handler;