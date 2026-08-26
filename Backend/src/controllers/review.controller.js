const mongoose = require("mongoose");
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

// --- Helper: Recalculate and update product rating ---
const updateProductRating = async (productId) => {
  const result = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    const avg = Math.round(result[0].averageRating * 10) / 10;
    await Product.findByIdAndUpdate(productId, {
      rating: avg,
      numReviews: result[0].numReviews,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      rating: 0,
      numReviews: 0,
    });
  }
};

// --- Helper: Check if user purchased and received the product ---
const hasDeliveredOrder = async (userId, productId) => {
  const order = await Order.findOne({
    user: userId,
    orderStatus: "delivered",
    "orderItems.product": productId,
  });
  return !!order;
};

// --- CREATE REVIEW ---
const createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, title, comment } = req.body;

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // Check product exists and is active
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    // Validate rating
    if (rating === undefined || rating === null) {
      return res.status(400).json({
        success: false,
        message: "Rating is required",
      });
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer from 1 to 5",
      });
    }

    // Validate comment
    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment is required",
      });
    }

    if (comment.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 1000 characters",
      });
    }

    // Check verified purchase (delivered order containing this product)
    const purchased = await hasDeliveredOrder(req.user._id, productId);
    if (!purchased) {
      return res.status(403).json({
        success: false,
        message: "You can only review products you have purchased and received",
      });
    }

    // Check for duplicate review
    const existingReview = await Review.findOne({
      user: req.user._id,
      product: productId,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    // Create review
    const review = await Review.create({
      user: req.user._id,
      product: productId,
      rating: ratingNum,
      title: title ? title.trim() : "",
      comment: comment.trim(),
    });

    // Recalculate product rating
    await updateProductRating(productId);

    return res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: {
        review: {
          id: review._id,
          user: review.user,
          product: review.product,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("CreateReview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- GET PRODUCT REVIEWS ---
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { product: productId };

    const [reviews, totalReviews] = await Promise.all([
      Review.find(filter)
        .populate("user", "name avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-__v"),
      Review.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalReviews / limit);

    return res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          page,
          limit,
          totalReviews,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("GetProductReviews Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- GET REVIEW BY ID ---
const getReviewById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(id)
      .populate("user", "name avatar")
      .select("-__v");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        review,
      },
    });
  } catch (error) {
    console.error("GetReviewById Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- UPDATE REVIEW ---
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Only the review owner can update
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own review",
      });
    }

    // Validate rating if provided
    if (rating !== undefined) {
      const ratingNum = Number(rating);
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be an integer from 1 to 5",
        });
      }
      review.rating = ratingNum;
    }

    // Validate title if provided
    if (title !== undefined) {
      if (title.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: "Title cannot exceed 100 characters",
        });
      }
      review.title = title.trim();
    }

    // Validate comment if provided
    if (comment !== undefined) {
      if (!comment.trim()) {
        return res.status(400).json({
          success: false,
          message: "Comment cannot be empty",
        });
      }
      if (comment.trim().length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Comment cannot exceed 1000 characters",
        });
      }
      review.comment = comment.trim();
    }

    await review.save();

    // Recalculate product rating
    await updateProductRating(review.product);

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: {
        review: {
          id: review._id,
          user: review.user,
          product: review.product,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("UpdateReview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- DELETE REVIEW ---
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Owner can delete own review, admin can delete any review
    const isOwner = review.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own review",
      });
    }

    const productId = review.product;

    await Review.findByIdAndDelete(id);

    // Recalculate product rating
    await updateProductRating(productId);

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("DeleteReview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getReviewById,
  updateReview,
  deleteReview,
};
