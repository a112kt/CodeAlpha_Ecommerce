const express = require("express");
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} = require("../controllers/product.controller");
const { protect } = require("../middleware/auth.middleware");
const { admin } = require("../middleware/admin.middleware");

const router = express.Router();

router.get("/", getProducts);
router.get("/:id", getProductById);

router.post("/", protect, admin, createProduct);
router.put("/:id", protect, admin, updateProduct);
router.delete("/:id", protect, admin, deleteProduct);

module.exports = router;
