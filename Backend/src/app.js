// const express = require("express");
// const cors = require("cors");

// const authRoutes = require("./routes/auth.routes");
// const categoryRoutes = require("./routes/category.routes");
// const productRoutes = require("./routes/product.routes");
// const cartRoutes = require("./routes/cart.routes");
// const orderRoutes = require("./routes/order.routes");
// const reviewRoutes = require("./routes/review.routes");
// const paymentRoutes = require("./routes/payment.routes");
// const { handleStripeWebhook } = require("./controllers/payment.controller");

// const app = express();

// // Stripe webhook needs the raw request body for signature verification.
// // Mount this BEFORE express.json() so the body is not parsed.
// app.post(
//   "/api/payments/webhook",
//   express.raw({ type: "application/json" }),
//   handleStripeWebhook
// );

// app.use(cors());
// app.use(express.json());

// app.get("/", (req, res) => {
//   res.json({
//     message: "E-Commerce API is running",
//   });
// });

// app.use("/api/auth", authRoutes);
// app.use("/api/categories", categoryRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/cart", cartRoutes);
// app.use("/api/orders", orderRoutes);
// app.use("/api", reviewRoutes);
// app.use("/api/payments", paymentRoutes);

// module.exports = app;

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const categoryRoutes = require("./routes/category.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");
const reviewRoutes = require("./routes/review.routes");
const paymentRoutes = require("./routes/payment.routes");

const { handleStripeWebhook } = require("./controllers/payment.controller");

const app = express();

// Stripe webhook MUST receive the raw body.
// This route must be registered BEFORE express.json().
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "E-Commerce API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api", reviewRoutes);
app.use("/api/payments", paymentRoutes);

module.exports = app;