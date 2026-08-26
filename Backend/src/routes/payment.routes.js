const express = require("express");
const {
  createPaymentIntent,
  verifyPayment,
} = require("../controllers/payment.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

// Protected payment routes
router.post("/create-intent", protect, createPaymentIntent);
router.post("/verify", protect, verifyPayment);

module.exports = router;
