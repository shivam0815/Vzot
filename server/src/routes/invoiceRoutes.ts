// src/routes/invoiceRoutes.ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getInvoicePdf } from "../controllers/invoiceController";

const r = Router();

/**
 * GET /api/orders/:id/invoice.pdf
 * Auth: user who owns the order or admin.
 * Use ?disposition=inline to preview in browser.
 */
r.get("/orders/:id/invoice.pdf", authenticate, getInvoicePdf);

export default r;
