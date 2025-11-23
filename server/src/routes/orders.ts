import express from 'express';
import {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  getAllOrders,
  getOrderDetails,
  getOrderByIdAdmin,
  
  cancelOrder,
  trackOrder,
} from '../controllers/orderController';
import { authenticate, authorize } from '../middleware/auth';
import { setPackageAndMaybeLink, createShippingPaymentLink } from '../controllers/shippingController';

const router = express.Router();

/**
 * Admin routes FIRST (and specific) – so they don't get captured by /:id
 */
router.get('/admin/all', authenticate, authorize(['admin', 'super_admin']), getAllOrders);
router.get('/admin/:id', authenticate, authorize(['admin', 'super_admin']), getOrderByIdAdmin);
router.put('/:id/status', authenticate, authorize(['admin', 'super_admin']), updateOrderStatus);
router.put('/:id/shipping/package', authenticate, authorize(['admin','super_admin']), setPackageAndMaybeLink);

// admin (re)creates a payment link
router.post('/:id/shipping/payment-link', authenticate, authorize(['admin','super_admin']), createShippingPaymentLink);
/**
 * User routes
 */
router.post('/', authenticate, createOrder);
router.get('/', authenticate, getOrders);

// Details expects :orderId (per your controller)
router.get('/details/:orderId', authenticate, getOrderDetails);


router.get('/track/:orderId', authenticate, trackOrder);
router.post('/:id/cancel', authenticate, cancelOrder);

// Keep this LAST so it doesn’t shadow the others
router.get('/:id', authenticate, getOrder);

export default router;
