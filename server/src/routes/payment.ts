import express from "express";
import { authenticate, adminAuth } from "../middleware/auth";
import {
  createPaymentOrder,
  verifyPayment,
  getPaymentStatus,
  getTodayPaymentsSummary,
  getAllPayments,
} from "../controllers/paymentController";

const router = express.Router();

// User routes
router.post("/create-order", authenticate, createPaymentOrder);
router.post("/verify", authenticate, verifyPayment);
router.get("/status/:orderId", authenticate, getPaymentStatus);

// Admin routes
router.get("/admin/today", adminAuth, getTodayPaymentsSummary);
router.get("/admin/all", adminAuth, getAllPayments);

export default router;
