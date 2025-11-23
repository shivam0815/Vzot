// src/models/User.ts - COMPLETE FIXED VERSION
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import speakeasy from 'speakeasy';


export interface IUser {
  // Basic Info
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role: 'user' | 'admin';
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };

  // ✅ ADDED - Account Status (was missing)
   status: 'active' | 'inactive' | 'suspended'; 
  businessName?: string;

  // OTP Email Verification
  isVerified: boolean;
  emailVerificationOtp?: string;
  emailVerificationOtpExpires?: Date;
  emailVerificationAttempts: number;

  // Password Reset
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  passwordResetOtp?: string;
  passwordResetOtpExpires?: Date;

  // Social Login Providers
  googleId?: string;
  facebookId?: string;
  githubId?: string;
  providers: string[];
  avatar?: string;

  // Two-Factor Authentication
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  twoFactorBackupCodes: string[];

  // ✅ ADDED - Security Features (was missing lockUntil)
  loginAttempts: number;
  lockUntil?: Date;
  lastLogin?: Date;
  lastLoginIP?: string;
  loginHistory: Array<{
    ip: string;
    userAgent: string;
    location?: string;
    timestamp: Date;
    success: boolean;
  }>;

  // Account Status
  isActive: boolean;
  deactivatedAt?: Date;
  deactivationReason?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateEmailVerificationOtp(): string;
  verifyEmailOtp(enteredOtp: string): boolean;
  generatePasswordResetOtp(): string;
  verifyPasswordResetOtp(enteredOtp: string): boolean;
  generateTwoFactorSecret(): { secret: string; otpauth_url: string };
  verifyTwoFactorToken(token: string): boolean;
  isAccountLocked(): boolean;
  incrementLoginAttempts(): Promise<any>;
  resetLoginAttempts(): Promise<any>;
  addLoginHistory(ip: string, userAgent: string, success: boolean): void;
}

const userSchema = new Schema<IUserDocument>({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10}$/, 'Please enter a valid phone number']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },

  // ✅ FIXED - Account Status (now properly defined in interface)
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  businessName: {
    type: String,
    trim: true
  },

  // OTP Email Verification
  isVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationOtp: String,
  emailVerificationOtpExpires: Date,
  emailVerificationAttempts: {
    type: Number,
    default: 0
  },

  // Password Reset with OTP
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordResetOtp: String,
  passwordResetOtpExpires: Date,

  // Social Login
  googleId: String,
  facebookId: String,
  githubId: String,
  providers: [{
    type: String,
    enum: ['local', 'google', 'facebook', 'github'],
    default: 'local'
  }],
  avatar: String,

  // Two-Factor Authentication
  twoFactorSecret: String,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorBackupCodes: [String],

  // ✅ FIXED - Security Features (lockUntil now properly defined)
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date, // ✅ This was missing from interface
  lastLogin: Date,
  lastLoginIP: String,
  loginHistory: [{
    ip: String,
    userAgent: String,
    location: String,
    timestamp: { type: Date, default: Date.now },
    success: { type: Boolean, default: true }
  }],

  // Account Status
  isActive: { type: Boolean, default: true },
  deactivatedAt: Date,
  deactivationReason: String
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ emailVerificationOtp: 1 });
userSchema.index({ passwordResetToken: 1 });
userSchema.index({ passwordResetOtp: 1 });
userSchema.index({ lockUntil: 1 });

// ✅ FIXED - Hash password before saving with proper typing
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    if (!this.password) return next(); // ✅ Added null check
    
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// ✅ FIXED - Account locking virtual with proper typing
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// ✅ FIXED - Instance methods with proper typing
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate Email Verification OTP
userSchema.methods.generateEmailVerificationOtp = function(): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  this.emailVerificationOtp = otp;
  this.emailVerificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.emailVerificationAttempts = 0;
  
  return otp;
};

// Verify Email OTP
userSchema.methods.verifyEmailOtp = function(enteredOtp: string): boolean {
  return this.emailVerificationOtp === enteredOtp && 
         this.emailVerificationOtpExpires! > new Date() &&
         this.emailVerificationAttempts < 5;
};

// Generate Password Reset OTP
userSchema.methods.generatePasswordResetOtp = function(): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  this.passwordResetOtp = otp;
  this.passwordResetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  return otp;
};

// Verify Password Reset OTP
userSchema.methods.verifyPasswordResetOtp = function(enteredOtp: string): boolean {
  return this.passwordResetOtp === enteredOtp && 
         this.passwordResetOtpExpires! > new Date();
};

userSchema.methods.generateTwoFactorSecret = function() {
  const secret = speakeasy.generateSecret({
    name: `Nakoda Mobile (${this.email})`,
    issuer: 'Nakoda Mobile'
  });
  
  this.twoFactorSecret = secret.base32;
  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url
  };
};

userSchema.methods.verifyTwoFactorToken = function(token: string): boolean {
  if (!this.twoFactorSecret) return false;
  
  return speakeasy.totp.verify({
    secret: this.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 2
  });
};

userSchema.methods.isAccountLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.incrementLoginAttempts = async function(): Promise<any> {
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates: any = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // 30 minutes
  }

  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function(): Promise<any> {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

userSchema.methods.addLoginHistory = function(ip: string, userAgent: string, success: boolean = true): void {
  this.loginHistory.push({
    ip,
    userAgent,
    location: undefined,
    timestamp: new Date(),
    success
  });
  
  if (this.loginHistory.length > 10) {
    this.loginHistory = this.loginHistory.slice(-10);
  }
};
const UserSchema = new Schema({
  // ...
  preferences: {
    notifications: { type: Boolean, default: true },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    language: { type: String, enum: ['en','hi','bn','ta','te','mr','gu'], default: 'en' }
  }
});
export default mongoose.model<IUserDocument>('User', userSchema);
