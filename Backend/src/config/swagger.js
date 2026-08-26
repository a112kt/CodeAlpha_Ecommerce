const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "CodeAlpha E-Commerce API",
      description:
        "REST API for CodeAlpha E-Commerce platform. Supports authentication (JWT), product catalog, shopping cart, orders, reviews, and Stripe payment processing.",
      version: "1.0.0",
      contact: {
        name: "CodeAlpha E-Commerce",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local development server",
      },
      {
        url: "https://code-alpha-ecommerce-puce.vercel.app",
        description: "Production server (Vercel)",
      },
    ],
    tags: [
      {
        name: "Auth",
        description: "User registration, login, and password management",
      },
      {
        name: "Categories",
        description: "Product category management (CRUD). Admin-only for create/update/delete.",
      },
      {
        name: "Products",
        description: "Product catalog with filtering, sorting, and pagination. Admin-only for create/update/delete.",
      },
      {
        name: "Cart",
        description: "Shopping cart management (authenticated users only)",
      },
      {
        name: "Orders",
        description: "Order creation, history, and management. Admin endpoints for order processing.",
      },
      {
        name: "Reviews",
        description: "Product review system. Verified purchase required to create reviews.",
      },
      {
        name: "Payments",
        description: "Stripe payment processing for online orders",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Enter your JWT token. Obtain it from POST /api/auth/login.",
        },
      },
      schemas: {
        // ── Reusable response wrappers ────────────────────────────────────
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error message" },
          },
        },

        // ── User ──────────────────────────────────────────────────────────
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            name: { type: "string", example: "John Doe" },
            email: { type: "string", format: "email", example: "john@example.com" },
            phone: { type: "string", example: "01000000000" },
            avatar: { type: "string", nullable: true, example: null },
            role: { type: "string", enum: ["user", "admin"], example: "user" },
          },
        },

        // ── Category ──────────────────────────────────────────────────────
        Category: {
          type: "object",
          properties: {
            id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            name: { type: "string", example: "Electronics" },
            slug: { type: "string", example: "electronics" },
            description: { type: "string", example: "Electronic devices and gadgets" },
            image: { type: "string", example: "https://example.com/electronics.jpg" },
            isActive: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        // ── Product ───────────────────────────────────────────────────────
        Product: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            name: { type: "string", example: "Wireless Headphones" },
            description: { type: "string", example: "Premium noise-cancelling headphones" },
            price: { type: "number", example: 299.99 },
            stock: { type: "integer", example: 50 },
            category: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string", example: "Electronics" },
                slug: { type: "string", example: "electronics" },
              },
            },
            images: { type: "array", items: { type: "string" }, example: ["https://example.com/headphones.jpg"] },
            brand: { type: "string", example: "Sony" },
            rating: { type: "number", example: 4.5 },
            numReviews: { type: "integer", example: 12 },
            isActive: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        // ── CartItem ──────────────────────────────────────────────────────
        CartItem: {
          type: "object",
          properties: {
            product: {
              type: "object",
              properties: {
                id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
                name: { type: "string", example: "Wireless Headphones" },
                price: { type: "number", example: 299.99 },
                image: { type: "string", nullable: true, example: "https://example.com/headphones.jpg" },
                stock: { type: "integer", example: 50 },
                isActive: { type: "boolean", example: true },
                category: { type: "string", example: "Electronics" },
              },
            },
            quantity: { type: "integer", example: 2 },
            itemTotal: { type: "number", example: 599.98 },
          },
        },

        // ── Cart ──────────────────────────────────────────────────────────
        Cart: {
          type: "object",
          properties: {
            items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
            totalItems: { type: "integer", example: 2 },
            subtotal: { type: "number", example: 599.98 },
          },
        },

        // ── ShippingAddress ───────────────────────────────────────────────
        ShippingAddress: {
          type: "object",
          required: ["fullName", "phone", "address", "city", "country", "postalCode"],
          properties: {
            fullName: { type: "string", example: "John Doe" },
            phone: { type: "string", example: "01000000000" },
            address: { type: "string", example: "123 Main Street" },
            city: { type: "string", example: "Cairo" },
            country: { type: "string", example: "Egypt" },
            postalCode: { type: "string", example: "11311" },
          },
        },

        // ── OrderItem ─────────────────────────────────────────────────────
        OrderItem: {
          type: "object",
          properties: {
            product: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            name: { type: "string", example: "Wireless Headphones" },
            price: { type: "number", example: 299.99 },
            quantity: { type: "integer", example: 2 },
            image: { type: "string", example: "https://example.com/headphones.jpg" },
            subtotal: { type: "number", example: 599.98 },
          },
        },

        // ── Order ─────────────────────────────────────────────────────────
        Order: {
          type: "object",
          properties: {
            id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            user: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            orderItems: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
            shippingAddress: { $ref: "#/components/schemas/ShippingAddress" },
            paymentMethod: { type: "string", enum: ["cash_on_delivery", "online"], example: "online" },
            paymentStatus: { type: "string", enum: ["pending", "paid", "failed", "cancelled"], example: "pending" },
            paymentIntentId: { type: "string", nullable: true, example: null },
            orderStatus: {
              type: "string",
              enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
              example: "pending",
            },
            subtotal: { type: "number", example: 599.98 },
            shippingFee: { type: "number", example: 0 },
            totalPrice: { type: "number", example: 599.98 },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        // ── Review ────────────────────────────────────────────────────────
        Review: {
          type: "object",
          properties: {
            id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            user: {
              type: "object",
              properties: {
                _id: { type: "string" },
                name: { type: "string", example: "John Doe" },
                avatar: { type: "string", nullable: true },
              },
            },
            product: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
            title: { type: "string", example: "Great product!" },
            comment: { type: "string", example: "Really impressed with the quality." },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },

        // ── Pagination ────────────────────────────────────────────────────
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalProducts: { type: "integer", example: 50 },
            totalPages: { type: "integer", example: 5 },
          },
        },

        PaginationOrders: {
          type: "object",
          properties: {
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalOrders: { type: "integer", example: 50 },
            totalPages: { type: "integer", example: 5 },
          },
        },

        PaginationReviews: {
          type: "object",
          properties: {
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalReviews: { type: "integer", example: 50 },
            totalPages: { type: "integer", example: 5 },
          },
        },
      },

      // ── Reusable responses ──────────────────────────────────────────────
      responses: {
        Unauthorized: {
          description: "Not authorized, no token provided",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "Not authorized, no token provided",
              },
            },
          },
        },
        Forbidden: {
          description: "Access denied. Admin only.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "Access denied. Admin only.",
              },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "Resource not found",
              },
            },
          },
        },
        ServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                success: false,
                message: "Server error",
              },
            },
          },
        },
      },
    },
  },
  // Path to files that contain OpenAPI annotations
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
