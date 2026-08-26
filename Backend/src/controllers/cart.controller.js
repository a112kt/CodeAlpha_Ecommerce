const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

// ─── Helper: Format cart response ───────────────────────────────────────────
const formatCartResponse = (cart) => {
  const items = cart.items.map((item) => {
    const product = item.product;
    return {
      product: {
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
        stock: product.stock,
        isActive: product.isActive,
        category: product.category,
      },
      quantity: item.quantity,
      itemTotal: product.price * item.quantity,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.itemTotal, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items,
    totalItems,
    subtotal,
  };
};

// ─── GET CART ───────────────────────────────────────────────────────────────
const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      select: "name price images stock isActive category",
      populate: { path: "category", select: "name slug" },
    });

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          cart: {
            items: [],
            totalItems: 0,
            subtotal: 0,
          },
        },
      });
    }

    const cartData = formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      data: {
        cart: cartData,
      },
    });
  } catch (error) {
    console.error("GetCart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── ADD TO CART ────────────────────────────────────────────────────────────
const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || !Number.isInteger(Number(quantity))) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

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

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + qty;

      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: "Requested quantity exceeds available stock",
        });
      }

      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      if (qty > product.stock) {
        return res.status(400).json({
          success: false,
          message: "Requested quantity exceeds available stock",
        });
      }

      cart.items.push({ product: productId, quantity: qty });
    }

    await cart.save();

    cart = await Cart.findById(cart._id).populate({
      path: "items.product",
      select: "name price images stock isActive category",
      populate: { path: "category", select: "name slug" },
    });

    const cartData = formatCartResponse(cart);

    return res.status(200).json({
      success: true,
      message: "Product added to cart",
      data: {
        cart: cartData,
      },
    });
  } catch (error) {
    console.error("AddToCart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── UPDATE CART ITEM ───────────────────────────────────────────────────────
const updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || !Number.isInteger(Number(quantity))) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

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

    if (qty > product.stock) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity exceeds available stock",
      });
    }

    cart.items[itemIndex].quantity = qty;
    await cart.save();

    const updatedCart = await Cart.findById(cart._id).populate({
      path: "items.product",
      select: "name price images stock isActive category",
      populate: { path: "category", select: "name slug" },
    });

    const cartData = formatCartResponse(updatedCart);

    return res.status(200).json({
      success: true,
      message: "Cart item updated",
      data: {
        cart: cartData,
      },
    });
  } catch (error) {
    console.error("UpdateCartItem Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── REMOVE FROM CART ───────────────────────────────────────────────────────
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    const updatedCart = await Cart.findById(cart._id).populate({
      path: "items.product",
      select: "name price images stock isActive category",
      populate: { path: "category", select: "name slug" },
    });

    const cartData = formatCartResponse(updatedCart);

    return res.status(200).json({
      success: true,
      message: "Product removed from cart",
      data: {
        cart: cartData,
      },
    });
  } catch (error) {
    console.error("RemoveFromCart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─── CLEAR CART ─────────────────────────────────────────────────────────────
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart cleared successfully",
      });
    }

    cart.items = [];
    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("ClearCart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
