const express = require("express");
const cors = require("cors");

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

// ======================================================
// Stripe Webhook
// MUST be registered BEFORE express.json()
// because Stripe requires the raw request body.
// ======================================================

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// ======================================================
// Middlewares
// ======================================================

app.use(cors());
app.use(express.json());

// ======================================================
// Swagger
// ======================================================

// Add Stripe webhook manually to Swagger documentation
// because it is registered directly in app.js.

swaggerSpec.paths = swaggerSpec.paths || {};

swaggerSpec.paths["/api/payments/webhook"] = {
  post: {
    tags: ["Payments"],
    summary: "Stripe webhook endpoint",
    description:
      "Receives Stripe webhook events for payment_intent.succeeded and payment_intent.payment_failed.",

    parameters: [
      {
        in: "header",
        name: "stripe-signature",
        required: true,
        schema: {
          type: "string",
        },
        description:
          "Stripe webhook signature automatically sent by Stripe.",
      },
    ],

    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
          },
        },
      },
    },

    responses: {
      "200": {
        description: "Webhook received successfully",
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
          },
        },
      },

      "400": {
        description: "Webhook signature verification failed",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
    },
  },
};

// Swagger UI — served via CDN (works reliably on Vercel serverless)
app.get("/api-docs", (req, res) => {
  const specUrl = `${req.protocol}://${req.get("host")}/api-docs.json`;

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeAlpha E-Commerce API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: "#swagger-ui",
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset,
      ],
      layout: "StandaloneLayout",
      docExpansion: "list",
      filter: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`);
});

// Raw OpenAPI JSON
app.get("/api-docs.json", (req, res) => {
  res.status(200).json(swaggerSpec);
});

// ======================================================
// Health Check
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    message: "E-Commerce API is running",
  });
});

// ======================================================
// API Routes
// ======================================================

app.use("/api/auth", authRoutes);

app.use("/api/categories", categoryRoutes);

app.use("/api/products", productRoutes);

app.use("/api/cart", cartRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api", reviewRoutes);

app.use("/api/payments", paymentRoutes);

// ======================================================
// Export
// ======================================================

module.exports = app;
