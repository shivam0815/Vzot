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

  // Account Status
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
 ordersCount?: number;        // total number of orders
  lifetimeValue?: number;      // total spend in ₹

  // Session analytics
  totalSessionMs?: number;     // total time spent (ms)
  sessionCount?: number;    
  // Security Features
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

  // New Analytics Fields
  lastDeviceType?: string;
  lastBrowser?: string;
  lastOS?: string;

  lastCity?: string;
  lastState?: string;
  lastCountry?: string;

  createdAt: Date;
  updatedAt: Date;

// Commerce / analytics
  

  // NEW — Device Info for Analytics
  

  // NEW — Location (Auto from IP)
 

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
  name: { type: String, required: true, trim: true, maxlength: 50 },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  password: { type: String, minlength: 6, select: false },
  phone: { type: String, match: [/^[0-9]{10}$/] },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' }
  },

  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  businessName: String,

  // Auth
  isVerified: { type: Boolean, default: false },
  emailVerificationOtp: String,
  emailVerificationOtpExpires: Date,
  emailVerificationAttempts: { type: Number, default: 0 },

  // Password Reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordResetOtp: String,
  passwordResetOtpExpires: Date,

  // Social
  googleId: String,
  facebookId: String,
  githubId: String,
  providers: [{ type: String, enum: ['local', 'google', 'facebook', 'github'], default: 'local' }],
  avatar: String,

  // 2FA
  twoFactorSecret: String,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorBackupCodes: [String],

  // Security
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  lastLogin: Date,
  lastLoginIP: String,
  loginHistory: [{
    ip: String,
    userAgent: String,
    location: String,
    timestamp: { type: Date, default: Date.now },
    success: { type: Boolean, default: true }
  }],
// Commerce / analytics
ordersCount: { type: Number, default: 0 },
lifetimeValue: { type: Number, default: 0 }, // in ₹
totalSessionMs: { type: Number, default: 0 },
sessionCount: { type: Number, default: 0 },

  // NEW — Device Info for Analytics
  lastDeviceType: { type: String },  // desktop/mobile/tablet
  lastBrowser: { type: String },
  lastOS: { type: String },

  // NEW — Location (Auto from IP)
  lastCity: { type: String },
  lastState: { type: String },
  lastCountry: { type: String },

  // Account
  isActive: { type: Boolean, default: true },
  deactivatedAt: Date,
  deactivationReason: String,

}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ lockUntil: 1 });

// Password Hash
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  if (!this.password) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Virtual
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Methods
userSchema.methods.comparePassword = async function(candidatePassword: string) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateEmailVerificationOtp = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.emailVerificationOtp = otp;
  this.emailVerificationOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  this.emailVerificationAttempts = 0;
  return otp;
};

userSchema.methods.verifyEmailOtp = function(otp: string) {
  return this.emailVerificationOtp === otp && this.emailVerificationOtpExpires! > new Date();
};

userSchema.methods.generatePasswordResetOtp = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.passwordResetOtp = otp;
  this.passwordResetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  return otp;
};

userSchema.methods.verifyPasswordResetOtp = function(otp: string) {
  return this.passwordResetOtp === otp && this.passwordResetOtpExpires! > new Date();
};

userSchema.methods.generateTwoFactorSecret = function() {
  const secret = speakeasy.generateSecret({ name: `Nakoda Mobile (${this.email})`, issuer: 'Nakoda Mobile' });
  this.twoFactorSecret = secret.base32;
  return { secret: secret.base32, otpauth_url: secret.otpauth_url };
};

userSchema.methods.verifyTwoFactorToken = function(token: string) {
  if (!this.twoFactorSecret) return false;
  return speakeasy.totp.verify({
    secret: this.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 2,
  });
};

userSchema.methods.isAccountLocked = function() {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.incrementLoginAttempts = async function() {
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({ $unset: { lockUntil: 1 }, $set: { loginAttempts: 1 } });
  }
  const updates: any = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5) updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 };
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({ $unset: { loginAttempts: 1, lockUntil: 1 } });
};

userSchema.methods.addLoginHistory = function(ip: string, userAgent: string, success = true) {
  this.loginHistory.push({ ip, userAgent, timestamp: new Date(), success });
  if (this.loginHistory.length > 10) this.loginHistory = this.loginHistory.slice(-10);
};

export default mongoose.model<IUserDocument>('User', userSchema);
