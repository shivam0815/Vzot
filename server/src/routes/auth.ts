// src/routes/auth.ts - ADD DEBUG ROUTES
import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  register,
  login,
  googleOAuthCallback,
  getProfile,
  updateProfile,
  changePassword,
  testDB,
  searchUsers,
  verifyEmailOtp,
  resendVerificationOtp,
  forgotPassword,
  resetPasswordWithOtp,
  manualVerify,
  
} from '../controllers/authController';
import passport from '../config/passport';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }),
  googleOAuthCallback as any
);

router.get('/google/failure', (req, res) => {
  const FRONTEND = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${FRONTEND}/login?error=google_auth_failed`);
});

// OTP Verification routes
router.post('/verify-email-otp', verifyEmailOtp);
router.post('/resend-verification-otp', resendVerificationOtp);

// Password reset with OTP
router.post('/forgot-password', forgotPassword);
router.post('/reset-password-otp', resetPasswordWithOtp);


router.post('/manual-verify', manualVerify);

// Protected routes (require authentication)
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

// Admin/utility routes
router.get('/test-db', testDB);
router.get('/search/:query', searchUsers);

export default router;
