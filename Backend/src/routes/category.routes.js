const express = require("express");
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");
const { protect } = require("../middleware/auth.middleware");
const { admin } = require("../middleware/admin.middleware");

const router = express.Router();

router.get("/", getCategories);
router.get("/:id", getCategoryById);

router.post("/", protect, admin, createCategory);
router.put("/:id", protect, admin, updateCategory);
router.delete("/:id", protect, admin, deleteCategory);

module.exports = router;
