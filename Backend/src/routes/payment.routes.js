const express = require("express");
const {
  createPaymentIntent,
  verifyPayment,
} = require("../controllers/payment.controller");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * /api/payments/create-intent:
 *   post:
 *     tags: [Payments]
 *     summary: Create a Stripe PaymentIntent
 *     description: |
 *       Create a Stripe PaymentIntent for an online order.
 *       The order must belong to the authenticated user, use "online" payment method,
 *       not be already paid, and not be cancelled.
 *       Returns the Stripe client secret for frontend payment confirmation.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: Order MongoDB ObjectId
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: PaymentIntent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                       description: Stripe client secret for frontend payment confirmation
 *                       example: "pi_3NkZ45ABC123_secret_abcdef123456"
 *       400:
 *         description: Invalid order, already paid, not online payment, or cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: You can only pay for your own orders
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/create-intent", protect, createPaymentIntent);

/**
 * @swagger
 * /api/payments/verify:
 *   post:
 *     tags: [Payments]
 *     summary: Verify a payment
 *     description: |
 *       Verify that a Stripe payment was successful for an order.
 *       Checks the PaymentIntent status with Stripe and updates the order's payment status.
 *       Returns "paid" if succeeded, "failed" otherwise.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: Order MongoDB ObjectId
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *     responses:
 *       200:
 *         description: Payment verification result
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Payment verified successfully"
 *                     data:
 *                       type: object
 *                       properties:
 *                         paymentStatus:
 *                           type: string
 *                           example: "paid"
 *                         orderStatus:
 *                           type: string
 *                           example: "pending"
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Payment not successful"
 *                     data:
 *                       type: object
 *                       properties:
 *                         paymentStatus:
 *                           type: string
 *                           example: "failed"
 *                         stripeStatus:
 *                           type: string
 *                         orderStatus:
 *                           type: string
 *       400:
 *         description: Invalid order, not online payment, or no payment intent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: You can only verify payment for your own orders
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/verify", protect, verifyPayment);

module.exports = router;
