const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

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

// Add Stripe webhook endpoint to the swagger spec (it is registered in app.js, not in a route file)
swaggerSpec.paths["/api/payments/webhook"] = {
  post: {
    tags: ["Payments"],
    summary: "Stripe webhook endpoint",
    description:
      "Receives Stripe webhook events for payment_intent.succeeded and payment_intent.payment_failed. This endpoint receives the raw request body for Stripe signature verification. No JWT authentication is required — Stripe authenticates via its own signature header (stripe-signature). This endpoint is registered BEFORE express.json() so the raw body is available.",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "string",
            description:
              "Raw Stripe event JSON payload. Do not send from Swagger — use Stripe CLI or your frontend for testing webhooks.",
          },
        },
      },
    },
    parameters: [
      {
        in: "header",
        name: "stripe-signature",
        required: true,
        schema: { type: "string" },
        description:
          "Stripe webhook signature header. Automatically included by Stripe when dispatching events.",
      },
    ],
    responses: {
      "200": {
        description: "Webhook received and processed",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                received: {
                  type: "boolean",
                  example: true,
                },
              },
            },
            example: { received: true },
          },
        },
      },
      "400": {
        description: "Webhook signature verification failed",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: {
              success: false,
              message: "Webhook Error: No signatures found matching the expected signature",
            },
          },
        },
      },
    },
  },
};

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "CodeAlpha E-Commerce API Docs",
  customCss: ".swagger-ui .topbar { display: none }",
}));

// Serve the raw OpenAPI JSON
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

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
