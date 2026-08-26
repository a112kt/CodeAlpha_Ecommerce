const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    image: {
      type: String,
      default: "",
    },
    subtotal: {
      type: Number,
      required: [true, "Item subtotal is required"],
      min: [0, "Subtotal cannot be negative"],
    },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
    postalCode: {
      type: String,
      required: [true, "Postal code is required"],
      trim: true,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    orderItems: {
      type: [orderItemSchema],
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: "Order must contain at least one item",
      },
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, "Shipping address is required"],
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
      enum: {
        values: ["cash_on_delivery", "online"],
        message: "Payment method must be either cash_on_delivery or online",
      },
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ["pending", "paid", "failed", "cancelled"],
        message: "Payment status must be pending, paid, failed, or cancelled",
      },
      default: "pending",
    },
    paymentIntentId: {
      type: String,
      default: null,
    },
    orderStatus: {
      type: String,
      enum: {
        values: [
          "pending",
          "confirmed",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
        ],
        message: "Invalid order status",
      },
      default: "pending",
    },
    subtotal: {
      type: Number,
      required: [true, "Subtotal is required"],
      min: [0, "Subtotal cannot be negative"],
    },
    shippingFee: {
      type: Number,
      required: [true, "Shipping fee is required"],
      min: [0, "Shipping fee cannot be negative"],
      default: 0,
    },
    totalPrice: {
      type: Number,
      required: [true, "Total price is required"],
      min: [0, "Total price cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
