const express = require("express");
const {
  createReview,
  getProductReviews,
  getReviewById,
  updateReview,
  deleteReview,
} = require("../controllers/review.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

// Product review routes (nested under products)
router.post("/products/:productId/reviews", protect, createReview);
router.get("/products/:productId/reviews", getProductReviews);

// Review-specific routes
router.get("/reviews/:id", getReviewById);
router.put("/reviews/:id", protect, updateReview);
router.delete("/reviews/:id", protect, deleteReview);

module.exports = router;
