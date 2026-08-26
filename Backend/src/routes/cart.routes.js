const express = require("express");
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} = require("../controllers/cart.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", protect, getCart);
router.post("/items", protect, addToCart);
router.put("/items/:productId", protect, updateCartItem);
router.delete("/items/:productId", protect, removeFromCart);
router.delete("/", protect, clearCart);

module.exports = router;
