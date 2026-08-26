const mongoose = require("mongoose");
const stripe = require("../config/stripe");
const Order = require("../models/Order");

const CURRENCY = process.env.PAYMENT_CURRENCY || "egp";

// --- Helper: Convert to Stripe smallest currency unit ---
const toStripeAmount = (amount) => {
  return Math.round(amount * 100);
};

// --- CREATE PAYMENT INTENT ---
const createPaymentIntent = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Find the order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify ownership
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only pay for your own orders",
      });
    }

    // Verify payment method
    if (order.paymentMethod !== "online") {
      return res.status(400).json({
        success: false,
        message: "This order does not use online payment",
      });
    }

    // Verify not already paid
    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This order is already paid",
      });
    }

    // Verify order is not cancelled
    if (order.orderStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot pay for a cancelled order",
      });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: toStripeAmount(order.totalPrice),
      currency: CURRENCY,

      // Only allow payment methods that don't require redirect
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },

      metadata: {
        orderId: order._id.toString(),
        userId: req.user._id.toString(),
      },
    });

    // Save PaymentIntent ID to order
    order.paymentIntentId = paymentIntent.id;

    await order.save({
      validateModifiedOnly: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
      },
    });
  } catch (error) {
    console.error("CreatePaymentIntent Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- VERIFY PAYMENT ---
const verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Find order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify ownership
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only verify payment for your own orders",
      });
    }

    // Verify payment method
    if (order.paymentMethod !== "online") {
      return res.status(400).json({
        success: false,
        message: "This order does not use online payment",
      });
    }

    // Verify PaymentIntent exists
    if (!order.paymentIntentId) {
      return res.status(400).json({
        success: false,
        message:
          "No payment intent found for this order. Please create one first.",
      });
    }

    // Retrieve PaymentIntent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(
      order.paymentIntentId
    );

    // Verify amount
    const expectedAmount = toStripeAmount(order.totalPrice);

    if (paymentIntent.amount !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch",
      });
    }

    // Verify currency
    if (paymentIntent.currency !== CURRENCY) {
      return res.status(400).json({
        success: false,
        message: "Payment currency mismatch",
      });
    }

    // Payment succeeded
    if (paymentIntent.status === "succeeded") {
      order.paymentStatus = "paid";

      await order.save({
        validateModifiedOnly: true,
      });

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: {
          paymentStatus: "paid",
          orderStatus: order.orderStatus,
        },
      });
    }

    // Payment not successful
    order.paymentStatus = "failed";

    await order.save({
      validateModifiedOnly: true,
    });

    return res.status(200).json({
      success: true,
      message: "Payment not successful",
      data: {
        paymentStatus: "failed",
        stripeStatus: paymentIntent.status,
        orderStatus: order.orderStatus,
      },
    });
  } catch (error) {
    console.error("VerifyPayment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// --- STRIPE WEBHOOK ---
const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error(
      "Webhook signature verification failed:",
      err.message
    );

    return res.status(400).json({
      success: false,
      message: `Webhook Error: ${err.message}`,
    });
  }

  // Handle Stripe events
  switch (event.type) {
    // -----------------------------------------
    // PAYMENT SUCCEEDED
    // -----------------------------------------
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;

      try {
        const order = await Order.findOne({
          paymentIntentId: paymentIntent.id,
        });

        if (!order) {
          console.error(
            "Webhook: Order not found for PaymentIntent:",
            paymentIntent.id
          );

          break;
        }

        // Idempotent: already paid
        if (order.paymentStatus === "paid") {
          break;
        }

        // Verify amount
        const expectedAmount = toStripeAmount(order.totalPrice);

        if (paymentIntent.amount !== expectedAmount) {
          console.error(
            "Webhook: Amount mismatch for order:",
            order._id
          );

          break;
        }

        // Verify currency
        if (paymentIntent.currency !== CURRENCY) {
          console.error(
            "Webhook: Currency mismatch for order:",
            order._id
          );

          break;
        }

        // Update payment status
        order.paymentStatus = "paid";

        await order.save({
          validateModifiedOnly: true,
        });

        console.log(
          "Webhook: Payment succeeded for order:",
          order._id
        );
      } catch (err) {
        console.error(
          "Webhook payment_intent.succeeded Error:",
          err
        );
      }

      break;
    }

    // -----------------------------------------
    // PAYMENT FAILED
    // -----------------------------------------
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;

      try {
        const order = await Order.findOne({
          paymentIntentId: paymentIntent.id,
        });

        if (!order) {
          console.error(
            "Webhook: Order not found for failed PaymentIntent:",
            paymentIntent.id
          );

          break;
        }

        // Idempotent: already failed
        if (order.paymentStatus === "failed") {
          break;
        }

        order.paymentStatus = "failed";

        await order.save({
          validateModifiedOnly: true,
        });

        console.log(
          "Webhook: Payment failed for order:",
          order._id
        );
      } catch (err) {
        console.error(
          "Webhook payment_intent.payment_failed Error:",
          err
        );
      }

      break;
    }

    // -----------------------------------------
    // OTHER EVENTS
    // -----------------------------------------
    default:
      console.log(
        "Webhook: Unhandled event type:",
        event.type
      );
  }

  // Always acknowledge webhook
  return res.status(200).json({
    received: true,
  });
};

module.exports = {
  createPaymentIntent,
  verifyPayment,
  handleStripeWebhook,
};