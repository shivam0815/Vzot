// backend/src/routes/return.routes.ts
import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth';
import {
  createReturnRequest,
  listMyReturns,
  getMyReturn,
  cancelMyReturn,
  adminListReturns,
  adminGetReturn,
  adminDecision,
  adminMarkReceived,
  adminRefund,
} from '../controllers/return.controller';

// Multer config (temp dir, 6 files max, 5MB each, images only)
const upload = multer({
  dest: 'tmp/',
  limits: { files: 6, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = Router();

/** ================= USER ================= */
router.get('/returns', authenticate, listMyReturns);
router.get('/returns/:id', authenticate, getMyReturn);
router.post('/returns', authenticate, upload.array('images', 6), createReturnRequest);
router.patch('/returns/:id/cancel', authenticate, cancelMyReturn);


router.use('/admin/returns', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});


router.get('/admin/returns', authenticate, authorize(['admin']), adminListReturns);
router.get('/admin/returns/:id', authenticate, authorize(['admin']), adminGetReturn);
router.patch('/admin/returns/:id/decision', authenticate, authorize(['admin']), adminDecision);
router.patch('/admin/returns/:id/received', authenticate, authorize(['admin']), adminMarkReceived);
router.patch('/admin/returns/:id/refund', authenticate, authorize(['admin']), adminRefund);

export default router;
