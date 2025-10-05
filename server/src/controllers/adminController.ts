// src/controllers/adminController.ts
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Product from '../models/Product';
import Order from '../models/Order';
import User from '../models/User';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { Parser as Json2CsvParser } from 'json2csv';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    isVerified: boolean;
    twoFactorEnabled: boolean;
  };
}

interface OTPData {
  otp: string;
  email: string;
  expiresAt: Date;
  attempts: number;
}

const otpStorage = new Map<string, OTPData>();

// ---------- Helpers (arrays/specs normalization) ----------
const asArray = (v: any): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {}
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

// ---------- Price/stock compatibility helpers ----------
const toNumber = (v: any) => (v === '' || v == null ? null : Number(v));

const mirrorCompare = <T extends Record<string, any>>(obj: T): T => {
  if (!obj) return obj;
  const out: any = { ...obj };
  const cmp = out.compareAtPrice ?? out.originalPrice;
  if (cmp !== undefined) {
    out.compareAtPrice = cmp;
    out.originalPrice = cmp;
  }
  if (out.stock !== undefined && out.stockQuantity === undefined) {
    out.stockQuantity = out.stock;
  }
  return out as T;
};

const normalizeOut = (p: any) => {
  const po = p && typeof p.toObject === 'function' ? p.toObject({ virtuals: true }) : p;
  const cmp = po?.compareAtPrice ?? po?.originalPrice ?? null;
  const stockQty = po?.stockQuantity ?? po?.stock ?? 0;
  return {
    ...po,
    compareAtPrice: cmp,
    originalPrice: cmp,
    stockQuantity: stockQty,
    stock: po?.stock ?? stockQty,
  };
};

const parseSpecs = (v: any): Record<string, any> => {
  if (!v) return {};
  if (typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const obj = JSON.parse(v);
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      return {};
    }
  }
  return {};
};

// ---------- Authorized Admin Emails ----------
const getAuthorizedEmails = (): string[] => {
  const emails = process.env.AUTHORIZED_ADMIN_EMAILS || '';
  return emails
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
};

const isAuthorizedAdminEmail = (email: string): boolean => {
  const authorizedEmails = getAuthorizedEmails();
  const normalizedEmail = email.trim().toLowerCase();

  console.log('🔍 Checking email authorization:', normalizedEmail);
  console.log('📋 Authorized emails:', authorizedEmails);

  return authorizedEmails.includes(normalizedEmail);
};

// ---------- Mail Transport ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ---------- OTP Utilities ----------
const generateOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

const cleanExpiredOTPs = () => {
  const now = new Date();
  for (const [key, value] of otpStorage.entries()) {
    if (value.expiresAt < now) {
      otpStorage.delete(key);
    }
  }
};

// ======================================
// 🔐 ADMIN AUTH (OTP + PASSWORD)
// ======================================

// Send Admin OTP
export const sendAdminOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Valid email required',
      });
    }

    if (!isAuthorizedAdminEmail(email)) {
      console.log('❌ Unauthorized admin access attempt:', email);
      return res.status(403).json({
        error: 'Access denied. Email not authorized for admin access.',
      });
    }

    console.log('✅ Email authorized for admin access:', email);

    cleanExpiredOTPs();

    const key = email.toLowerCase();
    const existingOTP = otpStorage.get(key);
    if (existingOTP && existingOTP.expiresAt > new Date()) {
      return res.status(429).json({
        error: 'OTP already sent',
        expiresIn: Math.ceil((existingOTP.expiresAt.getTime() - Date.now()) / 1000),
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    otpStorage.set(key, {
      otp,
      email: key,
      expiresAt,
      attempts: 0,
    });

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Admin Login OTP - Access Authorized',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">🔐 Admin Login Verification</h2>
          <p>Your admin access OTP code:</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #27ae60; margin: 0; font-size: 32px; letter-spacing: 8px;">${otp}</h1>
          </div>
          <p><strong>⏰ Valid for 10 minutes</strong></p>
          <p style="color: #e74c3c; font-size: 14px;">
            ⚠️ This is an authorized admin access attempt. If you didn't request this, please contact IT security immediately.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'OTP sent successfully to authorized admin email',
      email: key,
      expiresIn: 600,
      success: true,
    });
  } catch (error) {
    console.error('❌ OTP send error:', error);
    res.status(500).json({
      error: 'Failed to send OTP',
    });
  }
};

// Verify Admin OTP  ✅ FIXED to avoid duplicate email 500
export const verifyAdminOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        error: 'Email and OTP required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isAuthorizedAdminEmail(normalizedEmail)) {
      console.log('❌ Unauthorized verification attempt:', normalizedEmail);
      return res.status(403).json({
        error: 'Access denied. Email not authorized.',
      });
    }

    cleanExpiredOTPs();

    const storedOTPData = otpStorage.get(normalizedEmail);
    if (!storedOTPData) {
      return res.status(400).json({
        error: 'OTP not found or expired',
      });
    }

    if (storedOTPData.expiresAt < new Date()) {
      otpStorage.delete(normalizedEmail);
      return res.status(400).json({
        error: 'OTP expired',
      });
    }

    if (storedOTPData.attempts >= 3) {
      otpStorage.delete(normalizedEmail);
      return res.status(400).json({
        error: 'Too many attempts. Request new OTP.',
      });
    }

    if (storedOTPData.otp !== String(otp)) {
      storedOTPData.attempts += 1;
      otpStorage.set(normalizedEmail, storedOTPData);
      return res.status(400).json({
        error: 'Invalid OTP',
        attemptsLeft: 3 - storedOTPData.attempts,
      });
    }

    // OTP verified successfully
    otpStorage.delete(normalizedEmail);

    // ✅ SAFER: find by email only. Promote to admin if user exists; otherwise create.
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      user.role = 'admin';
      (user as any).status = 'active'; // keep for places checking string status
      user.isVerified = true;
      (user as any).isActive = true;
      try {
        await user.save();
      } catch (e: any) {
        console.error('❌ Failed to promote user to admin:', e?.message);
        return res.status(500).json({ error: 'Failed to promote account to admin' });
      }
    } else {
      user = new User({
        name: `Admin (${normalizedEmail.split('@')[0]})`,
        email: normalizedEmail,
        role: 'admin',
        status: 'active',
        isVerified: true,
        isActive: true,
      });
      try {
        await user.save();
      } catch (e: any) {
        if (e?.code === 11000) {
          console.error('❌ Duplicate key while creating admin:', normalizedEmail);
          return res.status(409).json({ error: 'Account with this email already exists' });
        }
        console.error('❌ Failed to create admin account:', e?.message);
        return res.status(500).json({ error: 'Failed to create admin account' });
      }
    }

    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      console.error('❌ JWT_SECRET missing');
      return res.status(500).json({ error: 'Server misconfiguration: JWT secret missing' });
    }

    const sessionToken = jwt.sign(
      {
        id: user.id.toString(),
        role: user.role,
        email: user.email,
      },
      secret,
      { expiresIn: '8h' }
    );

    console.log('✅ Admin OTP verification successful:', normalizedEmail);

    res.status(200).json({
      message: 'OTP verified - Admin access granted',
      sessionToken,
      success: true,
      admin: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ OTP verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
    });
  }
};

// Traditional Admin Login
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password required',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isAuthorizedAdminEmail(normalizedEmail)) {
      console.log('❌ Unauthorized admin login attempt:', normalizedEmail);
      res.status(403).json({
        success: false,
        message: 'Access denied. Email not authorized for admin access.',
      });
      return;
    }

    const admin = await User.findOne({
      email: normalizedEmail,
      role: 'admin',
    }).select('+password');

    if (!admin || !admin.password) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    if ((admin as any).status && (admin as any).status !== 'active') {
      res.status(401).json({
        success: false,
        message: 'Account disabled',
      });
      return;
    }
    if ((admin as any).isActive === false) {
      res.status(401).json({
        success: false,
        message: 'Account disabled',
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
      console.error('❌ JWT_SECRET missing');
      res.status(500).json({ success: false, message: 'Server misconfiguration: JWT secret missing' });
      return;
    }

    const token = jwt.sign(
      {
        id: admin.id.toString(),
        role: admin.role,
        email: admin.email,
      },
      secret,
      { expiresIn: '8h' }
    );

    admin.updatedAt = new Date();
    await admin.save();

    console.log('✅ Traditional admin login successful:', normalizedEmail);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin.id.toString(),
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// ======================================
// 📊 ADMIN DASHBOARD
// ======================================
export const getAdminStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('📊 Getting admin stats for user:', req.user);

    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
      return;
    }

    if (!isAuthorizedAdminEmail(req.user.email)) {
      console.log('❌ Admin access revoked for:', req.user.email);
      res.status(403).json({
        success: false,
        message: 'Admin access has been revoked',
      });
      return;
    }

    const [totalProducts, totalActiveProducts, totalOrders, pendingOrders, totalUsers] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: 'pending' }),
      User.countDocuments({ role: 'user' }),
    ]);

    const lowStockItems = await Product.countDocuments({
      stockQuantity: { $lte: 10 },
      isActive: true,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySalesResult = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          paymentStatus: { $in: ['paid', 'completed'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      totalProducts,
      totalActiveProducts,
      totalOrders,
      pendingOrders,
      totalUsers,
      lowStockItems,
      todaySales: todaySalesResult[0]?.total || 0,
      todayOrderCount: todaySalesResult[0]?.count || 0,
      authorizedEmails: getAuthorizedEmails().length,
    };

    console.log('✅ Stats fetched successfully:', stats);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
    });
  }
};

// ======================================
//
// 📦 PRODUCT CREATE (multi-image + JSON specs)
//
// ======================================
export const uploadProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('📦 Product upload started');
    console.log('📋 Request body keys:', Object.keys(req.body || {}));
    console.log('📁 Uploaded file(s):', (req as any).file ? 'single' : (req as any).files ? 'multiple/fields' : 'none');

    const {
      name,
      price,
      stock,
      category,
      description,
      // optional/advanced fields:
      features,
      tags,
      images, // optional URLs provided in body
      specifications,
      compareAtPrice, // ✅ NEW
      originalPrice, // JSON string or object

      // NEW (minimal SEO fields)
      metaTitle: _metaTitle,
      metaDescription: _metaDescription,
      // sku already flows through via separate APIs (if you add it here later, keep it minimal)
    } = req.body as any;

    // Validation
    if (!name || !price || !category) {
      res.status(400).json({
        success: false,
        message: 'Name, price, and category are required',
        missing: {
          name: !name,
          price: !price,
          category: !category,
        },
      });
      return;
    }

    const parsedPrice = parseFloat(price);
    const cmpRaw = compareAtPrice ?? originalPrice;
    const cmp = toNumber(cmpRaw);
    if (cmp != null) {
      if (!Number.isFinite(cmp) || !(cmp > parsedPrice)) {
        res.status(400).json({ success: false, message: 'compareAtPrice must be greater than price' });
        return;
      }
    }
    const parsedStock = parseInt(stock) || 0;

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      res.status(400).json({ success: false, message: 'Price must be a positive number' });
      return;
    }
    if (isNaN(parsedStock) || parsedStock < 0) {
      res.status(400).json({ success: false, message: 'Stock must be a non-negative number' });
      return;
    }

    // Collect file buffers from possible multer shapes
    const files: Express.Multer.File[] = [];
    const anyReq: any = req as any;
    if (anyReq.file && anyReq.file.buffer) {
      files.push(anyReq.file);
    } else if (anyReq.files) {
      const f = anyReq.files as Record<string, Express.Multer.File[]>;
      if (Array.isArray(f)) {
        files.push(...f);
      } else {
        if (f.productImage) files.push(...f.productImage);
        if (f['productImage[]']) files.push(...f['productImage[]']);
        if (f.images) files.push(...f.images);
        if (f['images[]']) files.push(...f['images[]']);
        if (f.photos) files.push(...f.photos);
        if (f['photos[]']) files.push(...f['photos[]']);
        if (f.image) files.push(...f.image);
        if (f.file) files.push(...f.file);
      }
    }

    // Upload each file to Cloudinary via your helper
    let uploadedUrls: string[] = [];
    if (files.length > 0) {
      try {
        console.log(`📤 Uploading ${files.length} image(s) to Cloudinary...`);
        const { uploadProductImages } = await import('../config/cloudinary');
        for (const file of files) {
          const publicId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const uploadResult = await uploadProductImages(file.buffer, publicId, file.originalname);
          uploadedUrls.push(uploadResult.url);
        }
        console.log(`✅ Uploaded ${uploadedUrls.length} image(s)`);
      } catch (uploadError: any) {
        console.error('❌ Cloudinary upload failed:', uploadError);
        res.status(500).json({
          success: false,
          message: 'Image upload failed',
          error: process.env.NODE_ENV === 'development' ? uploadError.message : 'Image upload error',
        });
        return;
      }
    } else {
      console.log('ℹ️ No files to upload via multipart');
    }

    // Also accept direct image URLs passed in body
    const bodyImageUrls = asArray(images);
    const finalImageUrls = [...bodyImageUrls, ...uploadedUrls];

    // NEW: clamp meta fields if provided
    const metaTitle =
      typeof _metaTitle === 'string' && _metaTitle.trim()
        ? _metaTitle.trim().slice(0, 60)
        : undefined;
    const metaDescription =
      typeof _metaDescription === 'string' && _metaDescription.trim()
        ? _metaDescription.trim().slice(0, 160)
        : undefined;

    // Build and save product
    const newProduct = new Product({
      name: String(name).trim(),
      description: String(description || '').trim(),
      price: parsedPrice,
      compareAtPrice: cmp ?? null,
      originalPrice: cmp ?? null,
      stockQuantity: parsedStock,
      category: String(category).trim(),
      images: finalImageUrls,
      features: asArray(features),
      tags: asArray(tags),
      specifications: parseSpecs(specifications),
      inStock: parsedStock > 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),

      // NEW: only these two
      metaTitle,
      metaDescription,
    });

    const savedProduct = await newProduct.save();
    console.log('✅ Product saved to database:', savedProduct._id);

    res.status(201).json({
      success: true,
      message: 'Product uploaded successfully',
      product: {
        id: savedProduct._id,
        name: savedProduct.name,
        price: savedProduct.price,
        stockQuantity: savedProduct.stockQuantity,
        category: savedProduct.category,
        images: savedProduct.images,
        features: savedProduct.features,
        tags: savedProduct.tags,
        specifications: savedProduct.specifications,
        // meta fields returned as saved
        metaTitle: savedProduct.metaTitle,
        metaDescription: savedProduct.metaDescription,
      },
    });
  } catch (error: any) {
    console.error('❌ Product upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Product upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = (req.params as any).productId || (req.params as any).id;
    if (!id) {
      res.status(400).json({ success: false, message: 'Product ID is required' });
      return;
    }

    const patch = mirrorCompare(req.body); // ensures compareAtPrice ↔ originalPrice; stock ↔ stockQuantity

    const priceNext = toNumber(patch.price);
    const cmpNext =
      patch.compareAtPrice != null
        ? toNumber(patch.compareAtPrice)
        : patch.originalPrice != null
        ? toNumber(patch.originalPrice)
        : null;

    if (cmpNext != null) {
      let priceToCheck = priceNext;
      if (priceToCheck == null) {
        const cur = await Product.findById(id).select('price').lean();
        priceToCheck = cur?.price ?? 0;
      }
      if (!(cmpNext > (priceToCheck ?? 0))) {
        res.status(400).json({ success: false, message: 'compareAtPrice must be greater than price' });
        return;
      }
    }

    // Parse flexible fields
    if (patch.features) patch.features = asArray(patch.features);
    if (patch.tags) patch.tags = asArray(patch.tags);
    if (patch.specifications) patch.specifications = parseSpecs(patch.specifications);
    if (patch.stock != null && patch.stockQuantity == null) patch.stockQuantity = Number(patch.stock);

    // NEW: clamp metaTitle/metaDescription ONLY if provided
    if (patch.metaTitle !== undefined && patch.metaTitle !== null) {
      patch.metaTitle = String(patch.metaTitle).trim().slice(0, 60);
    }
    if (patch.metaDescription !== undefined && patch.metaDescription !== null) {
      patch.metaDescription = String(patch.metaDescription).trim().slice(0, 160);
    }

    const updated = await Product.findByIdAndUpdate(
      id,
      { ...patch, updatedAt: new Date() },
      { new: true, runValidators: true, context: 'query' }
    );

    if (!updated) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    res.json({ success: true, product: normalizeOut(updated) });
  } catch (error: any) {
    console.error('❌ Update product error:', error);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};

// ======================================
// 🔄 PRODUCT STATUS
// ======================================
export const updateProductStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = (req.params as any).productId || (req.params as any).id;
    const { status } = req.body;
    if (!id) {
      res.status(400).json({ success: false, message: 'Product ID is required' });
      return;
    }
    if (!['active', 'inactive', 'draft', 'pending'].includes(String(status))) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }
    const doc = await Product.findByIdAndUpdate(
      id,
      { status, isActive: status === 'active', updatedAt: new Date() },
      { new: true, runValidators: true, context: 'query' }
    );
    if (!doc) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    res.json({ success: true, product: normalizeOut(doc) });
  } catch (e: any) {
    console.error('❌ Product status update error:', e);
    res.status(500).json({ success: false, message: 'Failed to update product status' });
  }
};

// ======================================
// 📚 ADMIN PRODUCT LISTING / UTILITIES
// ======================================

export const getAllProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '10'), 10) || 10, 1), 200);

    const status = String(req.query.status ?? '');
    const category = String(req.query.category ?? '');
    const search = String(req.query.search ?? '');
    const stockFilter = String(req.query.stockFilter ?? '');
    const sortBy = String(req.query.sortBy ?? 'name');
    const sortOrder = String(req.query.sortOrder ?? 'asc').toLowerCase() === 'desc' ? -1 : 1;

    const filter: any = {};
    if (status) {
      if (['active', 'inactive', 'draft'].includes(status.toLowerCase())) {
        filter.status = status.toLowerCase();
      }
    }
    if (category) filter.category = category;
    if (search) filter.$text = { $search: search };

    if (stockFilter === 'in-stock') filter.stockQuantity = { $gt: 0 };
    if (stockFilter === 'out-of-stock') filter.stockQuantity = { $eq: 0 };
    if (stockFilter === 'low-stock') filter.stockQuantity = { $gt: 0, $lte: 10 };

    const allowedSort = new Set([
      'name',
      'price',
      'compareAtPrice',
      'stockQuantity',
      'createdAt',
      'updatedAt',
      'rating',
      'reviews',
      'status',
    ]);
    const sort: any = {};
    sort[allowedSort.has(sortBy) ? sortBy : 'name'] = sortOrder;

    const skip = (page - 1) * limit;

    const [docs, totalProducts] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);

    const products = docs.map(normalizeOut);
    const totalPages = Math.max(Math.ceil(totalProducts / limit), 1);

    res.json({
      success: true,
      products,
      totalProducts,
      totalPages,
      currentPage: page,
    });
  } catch (error: any) {
    console.error('❌ Get products error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

// Delete Product (soft delete -> inactive)
export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('🗑️ Product deletion started');
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Product ID is required',
      });
      return;
    }

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found',
      });
      return;
    }

    await Product.findByIdAndUpdate(id, {
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ Product soft deleted successfully:', {
      id: product._id,
      name: product.name,
    });

    res.json({
      success: true,
      message: 'Product deleted successfully',
      productName: product.name,
    });
  } catch (error: any) {
    console.error('❌ Product deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// Update Product Stock
export const updateProductStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = (req.params as any).productId || (req.params as any).id;
    const body: any = req.body || {};
    const stockRaw = body.stockQuantity ?? body.stock; // accept either
    const n = Number(stockRaw);
    if (!id) {
      res.status(400).json({ success: false, message: 'Product ID is required' });
      return;
    }
    if (!Number.isInteger(n) || n < 0) {
      res.status(400).json({ success: false, message: 'Valid stock is required (non-negative integer)' });
      return;
    }
    const doc = await Product.findByIdAndUpdate(
      id,
      { stockQuantity: n, inStock: n > 0, updatedAt: new Date() },
      { new: true, runValidators: true, context: 'query' }
    );
    if (!doc) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }
    res.json({ success: true, product: normalizeOut(doc) });
  } catch (e: any) {
    console.error('❌ Product stock update error:', e);
    res.status(500).json({ success: false, message: 'Failed to update stock' });
  }
};

// Low Stock Products
export const getLowStockProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const threshold = Number(req.query.threshold ?? 10);
    const productsDocs = await Product.find({ stockQuantity: { $gt: 0, $lte: threshold }, isActive: true }).sort({
      stockQuantity: 1,
    });

    const products = productsDocs.map(normalizeOut);
    res.json({
      success: true,
      products,
      totalProducts: products.length,
      totalPages: 1,
      currentPage: 1,
    });
  } catch (error: any) {
    console.error('❌ Low stock products error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch low stock products' });
  }
};

// Admin Profile
export const getAdminProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const admin = await User.findById(req.user.id).select('-password');
    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin profile not found',
      });
      return;
    }

    res.json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: (admin as any).status,
        isVerified: (admin as any).isVerified,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('❌ Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    });
  }
};

export const exportProductsCsv = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filters: any = req.query || {};
    const q: any = {};
    if (filters.category) q.category = String(filters.category);
    if (filters.search) q.$text = { $search: String(filters.search) };

    const docs = await Product.find(q).sort({ createdAt: -1 });
    const rows = docs.map((d) => {
      const n = normalizeOut(d);
      return {
        Name: n.name,
        Price: n.price,
        CompareAtPrice: n.compareAtPrice ?? '',
        Stock: n.stockQuantity,
        Category: n.category,
        Status: n.status,
        Description: n.description ?? '',
        Images: (n.images || []).join('|'),
        CreatedAt: n.createdAt,
      };
    });

    const fields = Object.keys(rows[0] || { Name: '', Price: '' });
    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="products-${Date.now()}.csv"`);
    res.send(csv);
  } catch (e: any) {
    console.error('❌ Export CSV error:', e);
    res.status(500).json({ success: false, message: 'Failed to export products' });
  }
};
