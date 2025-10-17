// src/controllers/authController.ts - PRODUCTION VERSION WITH ALL FIXES
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import { emailService } from '../services/emailService';
import { RequestHandler } from 'express';
import { toIST } from '../config/time';

// Interfaces
interface AuthenticatedUser {
  id: string;
  role: string;
  email?: string;
  name?: string;
  isVerified?: boolean;
  twoFactorEnabled?: boolean;
}

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set');
}

// JWT Helper Function
const generateToken = (userId: string, userRole: string): string => {
  try {
    const payload = {
      id: userId,
      role: userRole
    };
    const secret = JWT_SECRET!;
    const options: SignOptions = {
      expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'],
      algorithm: 'HS256'
    };
    return jwt.sign(payload, secret, options);
  } catch (error) {
    console.error('JWT generation error:', error);
    throw new Error('Failed to generate JWT token');
  }
};

// REGISTER with OTP - FIXED VERSION
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, phone, role = 'user' } = req.body;
    console.log('📝 Registration attempt for:', email);

    // Validation
    if (!name || !email || !password) {
      console.log('❌ Registration validation failed - missing fields');
      res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ Registration failed - user already exists:', email);
      res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    console.log('🔐 Creating user - password will be hashed by model middleware');
    console.log('🔑 Original password length:', password?.length);

    // Create user - let the model's pre-save middleware handle password hashing
    const user = new User({
      name,
      email,
      password: password, // ✅ Plain password - model will hash it
      phone,
      role,
      isVerified: false,
      isActive: true
    });

    // Generate email verification OTP
    const verificationOtp = user.generateEmailVerificationOtp();
    
    console.log('💾 Saving user to database...');
    await user.save(); // This triggers the pre-save middleware to hash the password
    
    console.log('✅ User created successfully for:', email);
    console.log('📧 Generated OTP:', verificationOtp);

    // ✅ FIXED: Test password against the saved user's hashed password
    const savedUser = await User.findById(user.id).select('+password');
    const immediateTest = await bcrypt.compare(password, savedUser!.password!);
    console.log('🧪 Immediate password test after registration:', immediateTest);
    console.log('🔐 Password hash length:', savedUser?.password?.length);

    // Send verification OTP email
    try {
      await emailService.sendVerificationOtp(user, verificationOtp);
      console.log('📧 Verification OTP sent to:', email);
    } catch (emailError) {
      console.error('❌ Failed to send verification OTP:', emailError);
    }

    // Generate token for response
    const token = generateToken(user.id.toString(), user.role);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification code.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified
      },
      requiresEmailVerification: true
    });

  } catch (error: any) {
    console.error('💥 Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
};

// LOGIN - PRODUCTION VERSION
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    console.log('🔍 Login attempt for email:', email);

    // Validation
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.'
      });
      return;
    }

    // Check if email is verified
    if (!user.isVerified) {
      res.status(403).json({
        success: false,
        message: 'Please verify your email address with the OTP sent to your email',
        emailNotVerified: true,
        email: user.email
      });
      return;
    }

    // Password verification
    if (!user.password) {
      res.status(500).json({
        success: false,
        message: 'User password not found'
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Update login history
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    user.lastLogin = new Date();
    user.lastLoginIP = ip;
    user.addLoginHistory(ip, userAgent, true);
    await user.save();

    // Generate token
    const token = generateToken(user.id.toString(), user.role);
    console.log('✅ Login successful for:', email);

    res.json({
  success: true,
  message: 'Login successful',
  token,
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    createdAtIST: toIST(user.createdAt),
    updatedAtIST: toIST(user.updatedAt),
    ...(user.lastLogin ? { lastLoginIST: toIST(user.lastLogin) } : {}),
  }
});

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Login failed'
    });
  }
};

// GOOGLE OAUTH CALLBACK → ISSUE JWT + REDIRECT TO FRONTEND
export const googleOAuthCallback: RequestHandler = async (req, res) => {
  try {
    const user: any = (req as any).user;
    if (!user) {
      const FRONTEND = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${FRONTEND}/login?error=no_user_from_google`);
    }

    // Ensure verified/active flags
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }
    if (user.isActive === false) {
      const FRONTEND = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      return res.redirect(`${FRONTEND}/login?error=account_inactive`);
    }

    const token = generateToken(user.id.toString(), user.role || 'user');
    const FRONTEND = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

    // Send token to client via URL hash to avoid being logged by proxies
    return res.redirect(`${FRONTEND}/login-success#token=${token}`);
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    const FRONTEND = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${FRONTEND}/login?error=oauth_internal_error`);
  }
};

// VERIFY EMAIL OTP
export const verifyEmailOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Check if already verified
    if (user.isVerified) {
      res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
      return;
    }

    // Check OTP attempts
    if (user.emailVerificationAttempts >= 5) {
      res.status(429).json({
        success: false,
        message: 'Too many verification attempts. Please request a new code.'
      });
      return;
    }

    // Verify OTP
    if (!user.verifyEmailOtp(otp)) {
      // Increment attempts
      user.emailVerificationAttempts += 1;
      await user.save();

      res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
        attemptsRemaining: 5 - user.emailVerificationAttempts
      });
      return;
    }

    // Update user as verified
    user.isVerified = true;
    user.emailVerificationOtp = undefined;
    user.emailVerificationOtpExpires = undefined;
    user.emailVerificationAttempts = 0;
    await user.save();

    console.log('✅ Email verified successfully for:', user.email);

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });

  } catch (error: any) {
    console.error('Email OTP verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
};

// RESEND VERIFICATION OTP
export const resendVerificationOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
      return;
    }

    // Generate new OTP
    const verificationOtp = user.generateEmailVerificationOtp();
    await user.save();

    // Send OTP email
    try {
      await emailService.sendVerificationOtp(user, verificationOtp);
      console.log('📧 Verification OTP resent to:', email);
    } catch (emailError) {
      console.error('❌ Failed to resend verification OTP:', emailError);
      throw new Error('Failed to send verification email');
    }

    res.json({
      success: true,
      message: 'Verification code sent successfully'
    });

  } catch (error: any) {
    console.error('Resend verification OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification code'
    });
  }
};

// FORGOT PASSWORD with OTP
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset code has been sent.'
      });
      return;
    }

    // Generate password reset OTP
    const resetOtp = user.generatePasswordResetOtp();
    await user.save();

    // Send password reset OTP email
    try {
      await emailService.sendPasswordResetOtp(user, resetOtp);
      console.log('📧 Password reset OTP sent to:', email);
    } catch (emailError) {
      console.error('❌ Failed to send password reset OTP:', emailError);
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset code has been sent.'
    });

  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
};

// RESET PASSWORD with OTP - FIXED VERSION (NO DOUBLE HASHING)
export const resetPasswordWithOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required'
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
      return;
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Verify password reset OTP
    if (!user.verifyPasswordResetOtp(otp)) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code'
      });
      return;
    }

    console.log('✅ Reset OTP verified successfully');
    console.log('🔐 Setting new password - model will handle hashing');

    // ✅ FIX: Let the model's pre-save middleware handle hashing
    user.password = newPassword;  // Plain password - model will hash it
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpires = undefined;
    
    await user.save(); // Pre-save middleware will hash the plain password

    // ✅ Verify the password was saved correctly
    const savedUser = await User.findOne({ email }).select('+password');
    const finalTest = await bcrypt.compare(newPassword, savedUser!.password!);
    console.log('🧪 Final password test against saved hash:', finalTest);

    if (!finalTest) {
      console.error('❌ Password verification failed after save!');
      res.status(500).json({
        success: false,
        message: 'Password reset verification failed'
      });
      return;
    }

    console.log('✅ Password reset completed successfully for:', user.email);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset failed'
    });
  }
};

// GET PROFILE
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const userDetails = await User.findById(user.id).select('-password');
    if (!userDetails) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // ...
const u = userDetails;
res.json({
  success: true,
  user: {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isVerified: u.isVerified,
    isActive: u.isActive,
    createdAtIST: toIST(u.createdAt),
    updatedAtIST: toIST(u.updatedAt),
    ...(u.lastLogin ? { lastLoginIST: toIST(u.lastLogin) } : {}),
  }
});

  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get profile'
    });
  }
};

// UPDATE PROFILE
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { name, phone } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Name is required'
      });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(
      user.id,
      {
        name,
        phone,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
        updatedAt: updatedUser.updatedAt
      }
    });

  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update profile'
    });
  }
};

// CHANGE PASSWORD - FIXED VERSION (NO DOUBLE HASHING)
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthenticatedUser;
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
      return;
    }

    const userWithPassword = await User.findById(user.id).select('+password');
    if (!userWithPassword || !userWithPassword.password) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password);
    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
      return;
    }

    // ✅ FIX: Let model handle hashing
    userWithPassword.password = newPassword; // Plain password
    await userWithPassword.save(); // Pre-save middleware will hash it

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to change password'
    });
  }
};

// DATABASE TEST
export const testDB = async (req: Request, res: Response): Promise<void> => {
  try {
    const userCount = await User.countDocuments();
    const activeUserCount = await User.countDocuments({ isActive: true });
    const verifiedUserCount = await User.countDocuments({ isVerified: true });
    
    const sampleUsers = await User.find({})
      .select('name email role isActive isVerified createdAt')
      .limit(3)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      database: {
        status: 'Connected successfully',
        totalUsers: userCount,
        activeUsers: activeUserCount,
        verifiedUsers: verifiedUserCount,
        sampleUsers: sampleUsers.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          isVerified: user.isVerified,
          createdAt: user.createdAt
        }))
      }
    });

  } catch (error: any) {
    console.error('Database connection error:', error);
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      message: error.message
    });
  }
};

// MANUAL VERIFICATION (for testing - remove in production)
export const manualVerify = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    
    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );
    
    if (user) {
      console.log('✅ Manually verified:', email);
      res.json({ 
        success: true, 
        message: 'User verified manually',
        user: { email: user.email, isVerified: user.isVerified }
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Verification failed' 
    });
  }
};

// SEARCH USERS
export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.params;
    
    if (!query || query.length < 2) {
      res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
      return;
    }

    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    })
    .select('name email role isActive isVerified createdAt')
    .limit(10)
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }))
    });

  } catch (error: any) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
};
export const updatePreferences = async (
  req: Request & { user?: AuthenticatedUser }, 
  res: Response
) => {
  try {
    const { preferences } = req.body as {
      preferences: {
        notifications?: boolean;
        theme?: 'light' | 'dark';
        language?: 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'gu';
      };
    };

    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await User.findByIdAndUpdate(
      req.user.id,
      { $set: { preferences } },
      { new: true }
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('❌ updatePreferences error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update preferences' });
  }
};