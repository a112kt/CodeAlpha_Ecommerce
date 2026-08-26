const express = require("express");
const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  getAdminOrderById,
  updateOrderStatus,
} = require("../controllers/order.controller");
const { protect } = require("../middleware/auth.middleware");
const { admin } = require("../middleware/admin.middleware");

const router = express.Router();

// User routes (specific routes before parameterized routes)
router.post("/", protect, createOrder);
router.get("/my-orders", protect, getMyOrders);

// Admin routes (specific routes before parameterized routes)
router.get("/", protect, admin, getAllOrders);

// Parameterized routes (must come after specific routes)
router.get("/:id/admin", protect, admin, getAdminOrderById);
router.put("/:id/status", protect, admin, updateOrderStatus);
router.get("/:id", protect, getOrderById);
router.put("/:id/cancel", protect, cancelOrder);

module.exports = router;
