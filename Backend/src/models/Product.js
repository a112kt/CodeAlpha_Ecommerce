const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must be at least 2 characters"],
      maxlength: [150, "Product name cannot exceed 150 characters"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    stock: {
      type: Number,
      required: [true, "Product stock is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Product category is required"],
      ref: "Category",
    },
    images: {
      type: [String],
      default: [],
    },
    brand: {
      type: String,
      trim: true,
      default: "",
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot be more than 5"],
    },
    numReviews: {
      type: Number,
      default: 0,
      min: [0, "Number of reviews cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
