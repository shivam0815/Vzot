import express from 'express';
import { 
  adminOnly, 
  secureAdminOnly,
  auditLog,
  rateLimitSensitive,authenticate
} from '../middleware/auth';
import { upload, handleMulterError } from '../middleware/upload';
import {
  adminLogin,
  getAdminStats,
  uploadProduct,
  updateProductStatus,
  sendAdminOtp,
  verifyAdminOtp,
  updateProductStock, // ✅ added (matches controller + adminApi)
   getUsers,
  getUserAnalytics,
  updateUser,
  toggleUserStatus,
  deleteUser,
  sendPasswordResetEmail,
} from '../controllers/adminController';

import Product from '../models/Product';
import Return from '../models/ReturnRequest';
import Review from '../models/Review';
import Payment from '../models/Payment';
import User from '../models/User'; 
import type { SortOrder } from 'mongoose';
import type { Request, Response } from 'express';
import {
  getAllOrders,
  updateOrderStatus
} from '../controllers/orderController';
import { body, validationResult, query,param } from 'express-validator';
import SupportTicket from '../models/SupportTicket';
import SupportConfig from '../models/SupportConfig';
import SupportFaq from '../models/SupportFaq';
import ReturnRequest from '../models/ReturnRequest';
import { getLiveCartsAdmin } from '../controllers/cartController';


const resolveRange = (range?: string, from?: string, to?: string) => {
  if (from && to) return { since: new Date(from), until: new Date(to) };
  const now = new Date();
  let ms = 7 * 24 * 60 * 60 * 1000; // default 7d
  switch ((range || '7d').toLowerCase()) {
    case '24h': ms = 24 * 60 * 60 * 1000; break;
    case '7d': ms = 7 * 24 * 60 * 60 * 1000; break;
    case '30d': ms = 30 * 24 * 60 * 60 * 1000; break;
  }
  return { since: new Date(Date.now() - ms), until: now };
};

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};
const valid = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
  next();
};
const handleValidation = (req: Request, res: Response, _next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
  }
  _next();
};

// ===============================
// 🔐 PUBLIC ROUTES (No Authentication)
// ===============================

router.post('/send-otp', rateLimitSensitive, sendAdminOtp);
router.post('/verify-otp', rateLimitSensitive, verifyAdminOtp);
router.post('/login', rateLimitSensitive, adminLogin);

// ===============================
// 📊 ADMIN STATS & DASHBOARD
// ===============================

router.get('/stats', authenticate,
  ...adminOnly, 
  getAdminStats as express.RequestHandler
);

// ===============================
// 📦 PRODUCT MANAGEMENT
// ===============================

// Upload single/multiple products
router.post('/products/upload',authenticate,
  ...secureAdminOnly,
  upload.fields([
    { name: 'productImage', maxCount: 10 },
    { name: 'images', maxCount: 10 },
    { name: 'image', maxCount: 10 },
    { name: 'file', maxCount: 10 }
  ]), 
  handleMulterError,
  uploadProduct as express.RequestHandler
);

// Update product status
router.put('/products/:id/status',authenticate,
  ...adminOnly,
  auditLog('product-status-update'),
  updateProductStatus as express.RequestHandler
);

// ✅ Also expose PATCH to match adminApi (keeps original PUT intact)
router.patch('/products/:id/status',authenticate,
  ...adminOnly,
  auditLog('product-status-update'),
  updateProductStatus as express.RequestHandler
);

// Get products with pagination and filters (for inventory management)
router.get('/products', authenticate,
  ...adminOnly,
  async (req: express.Request, res: express.Response) => {
    try {
      console.log('📦 Admin: Fetching products for inventory management...');
      
      const {
        page = 1,
        limit = 10,
        search = '',
        category = '',
        stockFilter = '',
        sortBy = 'name',
        sortOrder = 'asc'
      } = req.query;

      // Build query object
      let query: any = {};
      
      // Search filter
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Category filter
      if (category) {
        query.category = category;
      }
      
      // Stock filter
      if (stockFilter) {
        switch (stockFilter) {
          case 'out-of-stock':
            query.stockQuantity = 0;
            break;
          case 'low-stock':
            query.stockQuantity = { $gt: 0, $lte: 10 };
            break;
          case 'in-stock':
            query.stockQuantity = { $gt: 10 };
            break;
        }
      }

      // Sort object
      const sortObj: any = {};
      sortObj[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Execute queries
      const [products, totalProducts] = await Promise.all([
        Product.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Product.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalProducts / limitNum);

      console.log(`✅ Admin: Found ${products.length} products`);

      res.json({
        success: true,
        products: products.map((product: any) => ({
          ...product,
          stock: product.stockQuantity,
          status: product.isActive ? 'active' : 'inactive'
        })),
        totalProducts,
        totalPages,
        currentPage: pageNum,
        message: 'Products fetched successfully'
      });

    } catch (error: any) {
      console.error('❌ Admin: Get products error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch products',
        error: error.message
      });
    }
  }
);

// Update single product
router.put('/products/:id',authenticate,
  ...adminOnly,
  auditLog('product-update'),
  async (req: express.Request, res: express.Response) => {
    try {
      console.log(`✏️ Admin: Updating product ${req.params.id}`);
      
      const { name, price, stock, category, description, status } = req.body as any;

      const updateData: any = {
        name,
        price: parseFloat(price),
        stockQuantity: parseInt(stock),
        category,
        description,
        isActive: status === 'active',
        inStock: parseInt(stock) > 0,
        updatedAt: new Date()
      };

      // ✅ compare@price support (admin can set either key)
      const compareRaw = (req.body as any).compareAtPrice ?? (req.body as any).originalPrice;
      if (compareRaw !== undefined) {
        const cmp = Number(compareRaw);
        const pnum = Number(updateData.price);
        if (Number.isFinite(cmp)) {
          // Validate only if price provided and valid
          if (Number.isFinite(pnum) && cmp <= pnum) {
            return res.status(400).json({
              success: false,
              message: 'compareAtPrice must be greater than price'
            });
          }
          updateData.compareAtPrice = cmp;
          updateData.originalPrice = cmp; // keep both in sync for legacy fields
        }
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      console.log('✅ Admin: Product updated successfully');

      res.json({
        success: true,
        product: {
          ...product.toObject(),
          stock: product.stockQuantity,
          status: product.isActive ? 'active' : 'inactive'
        },
        message: 'Product updated successfully'
      });

    } catch (error: any) {
      console.error('❌ Admin: Update product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update product',
        error: error.message
      });
    }
  }
);

// ✅ Stock-only endpoint (matches adminApi.updateProductStock)
router.patch('/products/:id/stock',authenticate,
  ...adminOnly,
  auditLog('product-stock-update'),
  updateProductStock as express.RequestHandler
);

// Delete single product
router.delete('/products/:id',
  ...secureAdminOnly,
  auditLog('product-deletion'),
  async (req: express.Request, res: express.Response) => {
    try {
      console.log(`🗑️ Admin: Deleting product ${req.params.id}`);
      
      const product = await Product.findByIdAndDelete(req.params.id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      console.log('✅ Admin: Product deleted successfully');

      res.json({
        success: true,
        message: 'Product deleted successfully'
      });

    } catch (error: any) {
      console.error('❌ Admin: Delete product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete product',
        error: error.message
      });
    }
  }
);

// Bulk update products
router.put('/products/bulk-update',authenticate,
  ...secureAdminOnly,
  auditLog('products-bulk-update'),
  async (req: express.Request, res: express.Response) => {
    try {
      console.log('📝 Admin: Bulk updating products');
      
      const { productIds, updateData } = req.body;

      if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Product IDs array is required'
        });
      }

      // Map frontend data to database fields
      const dbUpdateData: any = { updatedAt: new Date() };
      
      if (updateData.status) {
        dbUpdateData.isActive = updateData.status === 'active';
      }
      if (updateData.stock !== undefined) {
        dbUpdateData.stockQuantity = parseInt(updateData.stock);
        dbUpdateData.inStock = parseInt(updateData.stock) > 0;
      }

      const result = await Product.updateMany(
        { _id: { $in: productIds } },
        dbUpdateData
      );

      console.log(`✅ Admin: ${result.modifiedCount} products updated`);

      res.json({
        success: true,
        modifiedCount: result.modifiedCount,
        message: `${result.modifiedCount} products updated successfully`
      });

    } catch (error: any) {
      console.error('❌ Admin: Bulk update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update products',
        error: error.message
      });
    }
  }
);

// Bulk upload products
router.post('/products/bulk-upload',
  ...secureAdminOnly,
  auditLog('products-bulk-upload'),
  async (req: express.Request, res: express.Response) => {
    try {
      console.log('📦 Admin: Bulk uploading products');
      
      const { products } = req.body;

      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Products array is required and cannot be empty'
        });
      }

      const insertResults = await Product.insertMany(products, { 
        ordered: false,
        rawResult: true 
      });

      const successCount = insertResults.insertedCount;
      const failureCount = products.length - successCount;

      console.log(`✅ Admin: ${successCount} products uploaded, ${failureCount} failed`);

      res.json({
        success: true,
        successCount,
        failureCount,
        message: `${successCount} products uploaded successfully`
      });

    } catch (error: any) {
      console.error('❌ Admin: Bulk upload error:', error);
      
      // Handle partial success in bulk insert
      if (error.writeErrors) {
        const successCount = error.result.insertedCount || 0;
        const failureCount = error.writeErrors.length;
        
        return res.status(207).json({
          success: true,
          successCount,
          failureCount,
          message: `${successCount} products uploaded, ${failureCount} failed`,
          errors: error.writeErrors.map((err: any) => err.errmsg)
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to upload products',
        error: error.message
      });
    }
  }
);

// ===============================
// 🧾 ADMIN ORDER MANAGEMENT
// ===============================

// List orders with filters/pagination
router.get('/orders',
  ...adminOnly,
  getAllOrders as express.RequestHandler
);

// Generic status change
router.patch('/orders/:id/status',
  ...adminOnly,
  auditLog('order-status-update'),
  updateOrderStatus as express.RequestHandler
);

// Convenience endpoints
router.patch('/orders/:id/confirm',
  ...adminOnly,
  auditLog('order-confirm'),
  (req, res, next) => {
    req.body.status = 'confirmed';
    return (updateOrderStatus as any)(req, res, next);
  }
);

router.patch('/orders/:id/ship',
  ...adminOnly,
  auditLog('order-ship'),
  (req, res, next) => {
    req.body.status = 'shipped';
    return (updateOrderStatus as any)(req, res, next);
  }
);

router.patch('/orders/:id/deliver',
  ...adminOnly,
  auditLog('order-deliver'),
  (req, res, next) => {
    req.body.status = 'delivered';
    return (updateOrderStatus as any)(req, res, next);
  }
);

router.patch('/orders/:id/cancel',
  ...adminOnly,
  auditLog('order-cancel'),
  (req, res, next) => {
    req.body.status = 'cancelled';
    req.body.notes = req.body.notes || 'Cancelled by admin';
    return (updateOrderStatus as any)(req, res, next);
  }
);

// ===============================
// 🔄 ADMIN RETURNS MANAGEMENT
// ===============================

// GET /api/admin/returns - Get all returns with filtering
// admin router
type AdminReturnsQuery = {
  status?: 'all'
    | 'pending' | 'approved' | 'rejected'
    | 'pickup_scheduled' | 'in_transit' | 'received'
    | 'refund_initiated' | 'refund_completed' | 'cancelled' | 'closed';
  page?: string;   // comes in as string
  limit?: string;  // comes in as string
  q?: string;
};

router.get(
  '/returns',
  [
    ...adminOnly,
    query('status').optional().isIn([
      'all',
      'pending','approved','rejected',
      'pickup_scheduled','in_transit','received',
      'refund_initiated','refund_completed','cancelled','closed'
    ]),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  async (
    req: Request<{}, any, any, AdminReturnsQuery>,
    res: Response
  ): Promise<void> => {
    try {
      console.log('🔄 Admin: Fetching returns...');

      const status = req.query.status;
      const q = req.query.q;
      const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
      const limit = Math.min(100, parseInt(req.query.limit ?? '20', 10));
      const skip = (page - 1) * limit;

      const filter: Record<string, any> = {};
      if (status && status !== 'all') filter.status = status;
      if (q) filter.$text = { $search: q };

      const [rows, total] = await Promise.all([
        ReturnRequest.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('user', 'name email')
          .populate('order', 'orderNumber')
          .lean(),
        ReturnRequest.countDocuments(filter),
      ]);

      console.log(`✅ Admin: Found ${rows.length} returns`);

      res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma','no-cache');
      res.set('Expires','0');

      res.json({
        success: true,
        returns: rows,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err: any) {
      console.error('❌ Admin: Get returns error:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch returns' });
    }
  }
);


// GET /api/admin/returns/:id - Get specific return
router.get('/returns/:id', ...adminOnly, async (req, res) => {
  const r = await ReturnRequest.findById(req.params.id)
    .populate('user', 'name email phone')
    .populate('order', 'orderNumber')
    .lean();
  if (!r) return res.status(404).json({ success: false, message: 'Not found' });
  res.json({ success: true, returnRequest: r });
});


// PUT /api/admin/returns/:id/status - Update return status
router.put('/returns/:id/status', [
  ...adminOnly,
  auditLog('return-status-update'),
  body('status').isIn(['pending', 'approved', 'rejected', 'processed'])
], handleValidationErrors, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log(`🔄 Admin: Updating return ${req.params.id} status to ${req.body.status}`);
    
    const { status } = req.body;
    
    const updatedReturn = await Return.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedReturn) {
      res.status(404).json({ 
        success: false,
        error: 'Return not found' 
      });
      return;
    }

    console.log('✅ Admin: Return status updated successfully');

    res.status(200).json({
      success: true,
      data: updatedReturn,
      message: `Return status updated to ${status}`
    });
  } catch (error: any) {
    console.error('❌ Admin: Update return status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update return status',
      message: error.message
    });
  }
});

// POST /api/admin/returns - Create new return
router.post('/returns', [
  ...adminOnly,
  auditLog('return-create'),
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('productName').notEmpty().withMessage('Product name is required'),
  body('userId').notEmpty().withMessage('User ID is required'),
  body('userName').notEmpty().withMessage('User name is required'),
  body('userEmail').isEmail().withMessage('Valid email is required'),
  body('returnReason').notEmpty().withMessage('Return reason is required'),
  body('refundAmount').isNumeric().withMessage('Valid refund amount is required')
], handleValidationErrors, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log('🔄 Admin: Creating new return');
    
    const newReturn = new Return(req.body);
    const savedReturn = await newReturn.save();
    
    console.log('✅ Admin: Return created successfully');
    
    res.status(201).json({
      success: true,
      data: savedReturn,
      message: 'Return created successfully'
    });
  } catch (error: any) {
    console.error('❌ Admin: Create return error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create return',
      message: error.message
    });
  }
});


// ===============================
// 🧑‍🧑‍🧒 ADMIN USERS
// ===============================
router.get(
  '/carts/live',
  authenticate,
  ...adminOnly,
  getLiveCartsAdmin as express.RequestHandler
);
// GET /api/admin/users
// GET /api/admin/users

router.get(
  '/users',
  authenticate,
  ...adminOnly,
  getUsers as express.RequestHandler
);



// GET /api/admin/users/analytics
// GET /api/admin/users/analytics
router.get(
  '/users/analytics',
  authenticate,
  ...adminOnly,
  getUserAnalytics as express.RequestHandler
);

// PATCH /api/admin/users/:id/status -> active / inactive / banned
router.patch(
  '/users/:id/status',
  authenticate,
  ...adminOnly,
  auditLog('user-status-update'),
  toggleUserStatus as express.RequestHandler
);

// PATCH /api/admin/users/:id -> name/phone/role/status etc.
router.patch(
  '/users/:id',
  authenticate,
  ...adminOnly,
  auditLog('user-update'),
  updateUser as express.RequestHandler
);

// DELETE /api/admin/users/:id -> soft delete via controller
router.delete(
  '/users/:id',
  authenticate,
  ...adminOnly,
  auditLog('user-delete'),
  deleteUser as express.RequestHandler
);

// POST /api/admin/users/:id/password-reset
router.post(
  '/users/:id/password-reset',
  authenticate,
  ...adminOnly,
  auditLog('user-password-reset'),
  sendPasswordResetEmail as express.RequestHandler
);

// ===============================
// 💳 ADMIN PAYMENTS MANAGEMENT
// ===============================

// GET /api/admin/payments - Get all payments with filtering
router.get('/payments', [
  ...adminOnly,
  query('status').optional().isIn(['completed', 'pending', 'failed', 'refunded']),
  query('dateFilter').optional().isIn(['today', 'weekly', 'monthly']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log('💳 Admin: Fetching payments...');
    
    const { status, dateFilter, page = 1, limit = 20 } = req.query;
    
    let filter: any = {};
    
    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Date filter
    if (dateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          filter.paymentDate = { $gte: today };
          break;
        case 'weekly':
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          filter.paymentDate = { $gte: weekAgo };
          break;
        case 'monthly':
          const monthAgo = new Date(today);
          monthAgo.setMonth(today.getMonth() - 1);
          filter.paymentDate = { $gte: monthAgo };
          break;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(filter)
    ]);

    console.log(`✅ Admin: Found ${payments.length} payments`);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        hasNext: skip + payments.length < total,
        hasPrev: Number(page) > 1
      }
    });
  } catch (error: any) {
    console.error('❌ Admin: Get payments error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch payments',
      message: error.message
    });
  }
});

// GET /api/admin/payments/stats - Get payment statistics
router.get('/payments/stats', [
  ...adminOnly,
  query('dateFilter').optional().isIn(['today', 'weekly', 'monthly'])
], async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log('💳 Admin: Fetching payment statistics...');
    
    const { dateFilter } = req.query;
    let filter: any = {};

    // Apply date filter if specified
    if (dateFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (dateFilter) {
        case 'today':
          filter.paymentDate = { $gte: today };
          break;
        case 'weekly':
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          filter.paymentDate = { $gte: weekAgo };
          break;
        case 'monthly':
          const monthAgo = new Date(today);
          monthAgo.setMonth(today.getMonth() - 1);
          filter.paymentDate = { $gte: monthAgo };
          break;
      }
    }

    const stats = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0]
            }
          },
          totalTransactions: { $sum: 1 },
          completedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          failedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
            }
          },
          pendingPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
            }
          },
          refundedPayments: {
            $sum: {
              $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalRevenue: 0,
      totalTransactions: 0,
      completedPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
      refundedPayments: 0
    };

    console.log('✅ Admin: Payment statistics calculated');

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('❌ Admin: Get payment stats error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch payment stats',
      message: error.message
    });
  }
});

// PUT /api/admin/payments/:id/status - Update payment status
router.put('/payments/:id/status', [
  ...adminOnly,
  auditLog('payment-status-update'),
  body('status').isIn(['completed', 'pending', 'failed', 'refunded'])
], handleValidationErrors, async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    console.log(`💳 Admin: Updating payment ${req.params.id} status to ${req.body.status}`);
    
    const { status } = req.body;
    
    const updatedPayment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedPayment) {
      res.status(404).json({ 
        success: false,
        error: 'Payment not found' 
      });
      return;
    }

    console.log('✅ Admin: Payment status updated successfully');

    res.status(200).json({
      success: true,
      data: updatedPayment,
      message: `Payment status updated to ${status}`
    });
  } catch (error: any) {
    console.error('❌ Admin: Update payment status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update payment status',
      message: error.message
    });
  }
});



router.get(
  '/products/low-stock',
  ...adminOnly,
  ...secureAdminOnly,
  async (req, res) => {
    try {
      const threshold = Math.max(0, Number(req.query.threshold ?? 10));

      const products = await Product.find({
        $or: [
          { stock: { $exists: true, $lte: threshold } },
          { stockQuantity: { $exists: true, $lte: threshold } },
        ],
      })
        .sort({ updatedAt: -1 })
        .select(
          'name category price stock stockQuantity status imageUrl images updatedAt'
        );

      res.json({
        success: true,
        products,
        totalProducts: products.length,
        totalPages: 1,
        currentPage: 1,
      });
    } catch (err: any) {
      console.error('low-stock error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch low stock products',
      });
    }
  }
);














router.get(
  '/reviews',
  ...adminOnly,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'approved,', 'rejected', 'all']),
  async (req: Request, res: Response) => {
    try {
      const page  = Math.max(1, Number(req.query.page)  || 1);
      const limit = Math.min(100, Number(req.query.limit) || 20);
      const { status, productId, q } = req.query as any;

      const filter: any = {};
      if (status && status !== 'all') filter.status = status;
      if (productId) filter.productId = productId;
      if (q) {
        const rx = new RegExp(String(q), 'i');
        filter.$or = [
          { comment: rx },
          { userName: rx },
          { userEmail: rx },
          { productName: rx },
        ];
      }

      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        Review.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Review.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        reviews: items,
        page,
        totalPages: Math.ceil(total / limit),
        total,
      });
    } catch (err: any) {
      console.error('❌ Admin: list reviews error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to fetch reviews' });
    }
  }
);

// PATCH /api/admin/reviews/:id/status  { status: 'approved'|'rejected'|'pending' }
router.patch(
  '/reviews/:id/status',
  ...adminOnly,
  auditLog('review-status-update'),
  body('status').isIn(['approved', 'rejected', 'pending']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status: 'approved' | 'rejected' | 'pending' };

      const update: any = { status };
      if (status === 'approved') {
        update.approvedAt = new Date();
        update.approvedBy = (req as any).user?._id; // assumes your auth sets req.user
      }

      const updated = await Review.findByIdAndUpdate(id, update, { new: true });
      if (!updated) return res.status(404).json({ success: false, message: 'Review not found' });

      return res.json({ success: true, review: updated, message: `Review ${status}` });
    } catch (err: any) {
      console.error('❌ Admin: update review status error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to update review' });
    }
  }
);

// DELETE /api/admin/reviews/:id
router.delete(
  '/reviews/:id',
  ...secureAdminOnly,
  auditLog('review-delete'),
  async (req: Request, res: Response) => {
    try {
      const deleted = await Review.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Review not found' });
      return res.status(204).end();
    } catch (err: any) {
      console.error('❌ Admin: delete review error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to delete review' });
    }
  }
);









router.get(
  '/reviews',
  ...adminOnly,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  // ✅ fixed 'approved,' → 'approved'
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'all']),
  async (req: Request, res: Response) => {
    try {
      const page  = Math.max(1, Number(req.query.page)  || 1);
      const limit = Math.min(100, Number(req.query.limit) || 20);
      const { status, productId, q } = req.query as { status?: string; productId?: string; q?: string };

      const filter: Record<string, any> = {};
      if (status && status !== 'all') filter.status = status;
      if (productId) filter.productId = productId;
      if (q) {
        const rx = new RegExp(String(q), 'i');
        filter.$or = [{ comment: rx }, { userName: rx }, { userEmail: rx }, { productName: rx }];
      }

      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        Review.find(filter).sort({ createdAt: -1 as const }).skip(skip).limit(limit).lean(),
        Review.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        // ✅ normalized shape for the new ProductReview.tsx
        items,
        meta: { page, totalPages: Math.ceil(total / limit), total, limit },
      });
    } catch (err: any) {
      console.error('❌ Admin: list reviews error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to fetch reviews' });
    }
  }
);
// PATCH /api/admin/support/tickets/:id/status
router.patch(
  '/tickets/:id/status',
  ...adminOnly,
  auditLog('ticket-status-update'),
  [body('status').isIn(['open', 'in_progress', 'resolved', 'closed'])],
  valid,
  async (req: Request, res: Response) => {
    try {
      const doc = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );
      if (!doc) return res.status(404).json({ success: false, message: 'Ticket not found' });
      return res.json({ success: true, ticket: doc });
    } catch (err: any) {
      console.error('ticket status error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update status' });
    }
  }
);

// GET /api/admin/support/config


// PUT /api/admin/support/config
// Tickets list
router.get(
  '/support/tickets',
  ...adminOnly,
  [
    query('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed', 'all']),
    query('q').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  valid,
  async (req: Request, res: Response) => {
    try {
      const { status, q } = req.query as { status?: string; q?: string };
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Number(req.query.limit) || 20);
      const skip = (page - 1) * limit;

      const filter: Record<string, any> = {};
      if (status && status !== 'all') filter.status = status;
      if (q) {
        const rx = new RegExp(String(q), 'i');
        filter.$or = [{ subject: rx }, { message: rx }, { email: rx }, { orderId: rx }];
      }

      const [items, total] = await Promise.all([
        SupportTicket.find(filter).sort({ createdAt: -1 as const }).skip(skip).limit(limit).lean(),
        SupportTicket.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        items,
        meta: { page, totalPages: Math.ceil(total / limit), total, limit },
      });
    } catch (err: any) {
      console.error('admin/support/tickets error:', err);
      return res.status(500).json({ success: false, message: 'Failed to load tickets' });
    }
  }
);

// Update ticket status
router.patch(
  '/support/tickets/:id/status',
  ...adminOnly,
  auditLog('ticket-status-update'),
  [body('status').isIn(['open', 'in_progress', 'resolved', 'closed'])],
  valid,
  async (req: Request, res: Response) => {
    try {
      const doc = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );
      if (!doc) return res.status(404).json({ success: false, message: 'Ticket not found' });
      return res.json({ success: true, ticket: doc });
    } catch (err: any) {
      console.error('ticket status error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update status' });
    }
  }
);

// Admin support config
// Admin: GET /api/admin/support/config
router.get('/support/config', ...adminOnly, async (_req, res) => {
  try {
    let doc = await SupportConfig.findOne(); // hydrate
    if (!doc) {
      doc = await SupportConfig.create({});
    }
    return res.json({ success: true, config: doc.toObject() }); // consistent
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to load config' });
  }
});


router.put(
  '/support/config',
  ...secureAdminOnly,
  auditLog('support-config-update'),
  [
    body('channels').optional().isObject(),
    body('email').optional().isObject(),
    body('phone').optional().isObject(),
    body('whatsapp').optional().isObject(),
    body('faq').optional().isObject(),
  ],
  valid,
  async (req: Request, res: Response) => {
    try {
      const cfg = await SupportConfig.findOneAndUpdate(
        {},
        { ...req.body, updatedAt: new Date() },
        { new: true, upsert: true }
      );
      return res.json({ success: true, config: cfg });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: 'Failed to update config' });
    }
  }
);

// Admin FAQ CRUD
/* --------------------------------- FAQs ----------------------------------- */
// GET /api/admin/support/faqs?q=
router.get(
  '/support/faqs',
  ...adminOnly,
  [query('q').optional().isString()],
  handleValidation,
  async (req: Request<{}, any, any, { q?: string }>, res: Response): Promise<void> => {
    const { q } = req.query;
    const filter: Record<string, any> = {};
    const sort: Record<string, SortOrder> = { order: 1, createdAt: -1 };

    const docs = q
      ? await SupportFaq.find({ $text: { $search: String(q) } }).sort(sort).lean()
      : await SupportFaq.find(filter).sort(sort).lean();

    res.json({ success: true, faqs: docs });
  }
);

// POST /api/admin/support/faqs
router.post(
  '/support/faqs',
  ...secureAdminOnly,
  [
    body('question').isString().trim().isLength({ min: 5 }),
    body('answer').isString().trim().isLength({ min: 5 }),
    body('category').optional().isString(),
    body('order').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  handleValidation,
  async (req: Request, res: Response): Promise<void> => {
    const faq = await SupportFaq.create({
      question: req.body.question,
      answer: req.body.answer,
      category: req.body.category,
      order: req.body.order ?? 0,
      isActive: req.body.isActive ?? true,
    });
    res.status(201).json({ success: true, faq });
  }
);

// PUT /api/admin/support/faqs/:id
router.put(
  '/support/faqs/:id',
  ...secureAdminOnly,
  [
    param('id').isMongoId(),
    body('question').optional().isString().trim().isLength({ min: 5 }),
    body('answer').optional().isString().trim().isLength({ min: 5 }),
    body('category').optional().isString(),
    body('order').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  handleValidation,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    const faq = await SupportFaq.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!faq) {
      res.status(404).json({ success: false, message: 'FAQ not found' });
      return;
    }
    res.json({ success: true, faq });
  }
);

// DELETE /api/admin/support/faqs/:id
router.delete(
  '/support/faqs/:id',
  ...secureAdminOnly,
  [param('id').isMongoId()],
  handleValidation,
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    await SupportFaq.findByIdAndDelete(id);
    res.status(204).end();
  }
);



export default router; 