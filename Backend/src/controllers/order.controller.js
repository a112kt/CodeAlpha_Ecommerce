const mongoose = require("mongoose");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

const VALID_PAYMENT_METHODS = ["cash_on_delivery", "online"];
const VALID_PAYMENT_STATUSES = ["pending", "paid", "failed", "cancelled"];
const VALID_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const SHIPPING_FEE = 0;

const validateShippingAddress = (address) => {
  const errors = [];
  if (!address) return ["Shipping address is required"];
  if (!address.fullName || !address.fullName.trim())
    errors.push("Full name is required");
  if (!address.phone || !address.phone.trim())
    errors.push("Phone number is required");
  if (!address.address || !address.address.trim())
    errors.push("Address is required");
  if (!address.city || !address.city.trim()) errors.push("City is required");
  if (!address.country || !address.country.trim())
    errors.push("Country is required");
  if (!address.postalCode || !address.postalCode.trim())
    errors.push("Postal code is required");
  return errors;
};

// --- CREATE ORDER ---
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { shippingAddress, paymentMethod } = req.body;

    // Validate shipping address
    const addressErrors = validateShippingAddress(shippingAddress);
    if (addressErrors.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: addressErrors.join(". "),
      });
    }

    // Validate payment method
    if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment method. Must be cash_on_delivery or online",
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).session(session);

    if (!cart) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cart not found. Please add items before placing an order",
      });
    }

    if (!cart.items || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Cart is empty. Please add items before placing an order",
      });
    }

    // Fetch all products and validate
    const productIds = cart.items.map((item) => item.product);
    const products = await Product.find({ _id: { $in: productIds } }).session(
      session
    );

    const productMap = new Map();
    products.forEach((p) => productMap.set(p._id.toString(), p));

    // Validate each cart item
    const orderItems = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const product = productMap.get(item.product.toString());

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Product not found in catalog`,
        });
      }

      if (!product.isActive) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" is no longer available`,
        });
      }

      if (product.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${product.name}. Available: ${product.stock}, requested: ${item.quantity}`,
        });
      }

      const itemPrice = product.price;
      const itemSubtotal = itemPrice * item.quantity;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: itemPrice,
        quantity: item.quantity,
        image:
          product.images && product.images.length > 0
            ? product.images[0]
            : "",
        subtotal: itemSubtotal,
      });

      subtotal += itemSubtotal;
    }

    const shippingFee = SHIPPING_FEE;
    const totalPrice = subtotal + shippingFee;

    // Create order within transaction
    const [order] = await Order.create(
      [
        {
          user: req.user._id,
          orderItems,
          shippingAddress: {
            fullName: shippingAddress.fullName.trim(),
            phone: shippingAddress.phone.trim(),
            address: shippingAddress.address.trim(),
            city: shippingAddress.city.trim(),
            country: shippingAddress.country.trim(),
            postalCode: shippingAddress.postalCode.trim(),
          },
          paymentMethod,
          paymentStatus: "pending",
          orderStatus: "pending",
          subtotal,
          shippingFee,
          totalPrice,
        },
      ],
      { session }
    );

    // Decrease stock for each product
    for (const item of orderItems) {
      const stockResult = await Product.updateOne(
        {
          _id: item.product,
          stock: { $gte: item.quantity },
        },
        {
          $inc: { stock: -item.quantity },
        },
        { session }
      );

      if (stockResult.modifiedCount === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${item.name}`,
        });
      }
    }

    // Clear the cart
    cart.items = [];
    await cart.save({ session, validateModifiedOnly: true });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order: {
          id: order._id,
          user: order.user,
          orderItems: order.orderItems,
          shippingAddress: order.shippingAddress,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          subtotal: order.subtotal,
          shippingFee: order.shippingFee,
          totalPrice: order.totalPrice,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("CreateOrder Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- GET MY ORDERS ---
const getMyOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-__v"),
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalOrders / limit);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          totalOrders,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("GetMyOrders Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- GET ORDER BY ID ---
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id).select("-__v");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Non-admin users can only view their own orders
    if (req.user.role !== "admin" && order.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order,
      },
    });
  } catch (error) {
    console.error("GetOrderById Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- CANCEL ORDER ---
const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id).session(session);

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Only the order owner can cancel
    if (order.user.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order can be cancelled
    if (order.orderStatus === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    if (order.orderStatus === "shipped" || order.orderStatus === "delivered") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.orderStatus}`,
      });
    }

    // Restore stock for each item
    for (const item of order.orderItems) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } },
        { session }
      );
    }

    // Update order status
    order.orderStatus = "cancelled";
    await order.save({ session, validateModifiedOnly: true });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        order: {
          id: order._id,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          updatedAt: order.updatedAt,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("CancelOrder Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- GET ALL ORDERS (Admin) ---
const getAllOrders = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const filter = {};

    if (status) {
      if (!VALID_ORDER_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}`,
        });
      }
      filter.orderStatus = status;
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-__v"),
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalOrders / limit);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          totalOrders,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("GetAllOrders Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- GET ADMIN ORDER BY ID ---
const getAdminOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id)
      .populate("user", "name email phone")
      .select("-__v");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order,
      },
    });
  } catch (error) {
    console.error("GetAdminOrderById Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- UPDATE ORDER STATUS (Admin) ---
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!status || !VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}`,
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Validate status transition
    const allowedTransitions = STATUS_TRANSITIONS[order.orderStatus] || [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change order status from "${order.orderStatus}" to "${status}"`,
      });
    }

    order.orderStatus = status;

    // If delivered, auto-mark payment as paid for COD
    if (status === "delivered" && order.paymentMethod === "cash_on_delivery") {
      order.paymentStatus = "paid";
    }

    await order.save({ validateModifiedOnly: true });

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: {
        order: {
          id: order._id,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          updatedAt: order.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("UpdateOrderStatus Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  getAdminOrderById,
  updateOrderStatus,
};
