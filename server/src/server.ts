// server.ts — PRODUCTION-READY for nokodamobile.in
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { connectDatabase } from './config/database';
import passport from './config/passport';

import searchRoutes from './routes/searchRoutes';
import reviewsPublic from './routes/reviews.public';
import chatRoutes from './routes/chat';
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import oemRoutes from './routes/oem';
import adminRoutes from './routes/admin';
import paymentRoutes from './routes/payment';
import wishlistRoutes from './routes/wishlistRoutes';
import newsletterRoutes from './routes/newsletter.routes';
import contactRoutes from './routes/contact.routes';
import blogRoutes from './routes/blog.routes';
// import reviewsRouter from './routes/review';
import helpRoutes from './routes/helpRoutes';
import supportRouter from './routes/support.routes';
import notificationRoutes from './routes/notification.routes';
import returnRoutes from './routes/return.routes';
import shiprocketRoutes from './routes/shiprocketRoutes';
import { authenticate, adminOnly } from './middleware/auth';
import phoneAuthRoutes from './routes/auth.phone';
import webhookRouter from './routes/webhooks';


const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

const userRoutes = require('./routes/user');

// ✅ Required envs (fail fast in prod)
const requiredEnvVars = [
  'JWT_SECRET',
  'MONGODB_URI',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  
  'OPENAI_API_KEY'
];
if (isProd) {
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
  if (missingEnvVars.length) {
    console.error('❌ Missing required environment variables:', missingEnvVars);
    process.exit(1);
  }
}

// --- Origins / CORS ---
const devOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
const runtimeFrontend = process.env.FRONTEND_URL?.trim();
const prodOrigins = [
  'https://nakodamobile.com',
  'https://www.nakodamobile.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000',

  ...(runtimeFrontend ? [runtimeFrontend] : [])
];
const allowedOrigins = isProd ? prodOrigins : devOrigins;

// ✅ Socket.IO
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin(origin, cb) {
      if (!origin) return cb(null, true); // SSR / curl
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (!isProd) return cb(null, true);
      console.warn('❌ Socket.IO CORS blocked:', origin);
      cb(new Error('Not allowed by Socket.IO CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Connect DB
connectDatabase();

// Paths
const uploadsDir = path.resolve(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadsDir);
}

// Security middleware
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));

// Trust proxy (Nginx/Cloudflare)
app.set('trust proxy', 1);

// HSTS in prod
if (isProd) {
  app.use((_req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    next();
  });   
}

app.use(compression());

// Request ID
app.use((req, res, next): void => {
  (req as any).requestId = Math.random().toString(36).slice(2, 10);
  res.setHeader('X-Request-ID', (req as any).requestId);
  next();
});

// Ensure utf-8 charset sticks to text/json responses
app.use((req, res, next) => {
  const set = res.setHeader.bind(res);
  res.setHeader = (name: string, value: any) => {
    if (
      name.toLowerCase() === 'content-type' &&
      typeof value === 'string' &&
      /^(application\/json|text\/html|text\/plain)/i.test(value) &&
      !/charset=/i.test(value)
    ) value = `${value}; charset=UTF-8`;
    return set(name, value);
  };
  next();
});


// Rate limiting
const parseCIDR = (cidr: string) => {
  const [addr, maskStr] = cidr.split('/');
  const mask = Number(maskStr ?? '32');
  const toLong = (ip: string) => ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
  return { base: toLong(addr), maskBits: mask };
};
const allowlistEntries = (process.env.RATE_LIMIT_WHITELIST ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowlist: Array<{type:'ip'|'cidr', value:string, base?:number, maskBits?:number}> =
  allowlistEntries.map(v => {
    if (v.includes('/')) {
      const { base, maskBits } = parseCIDR(v);
      return { type: 'cidr', value: v, base, maskBits };
    }
    return { type: 'ip', value: v };
  });

const isAllowlisted = (ip?: string) => {
  if (!ip) return false;
  for (const e of allowlist) {
    if (e.type === 'ip' && e.value === ip) return true;
    if (e.type === 'cidr') {
      const toLong = (x: string) => x.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
      const ipLong = toLong(ip);
      // maskBits N → compare top N bits
      const shift = 32 - (e.maskBits ?? 32);
      const mask = shift === 32 ? 0 : 0xffffffff << shift;
      if ((ipLong & mask) === ((e.base ?? 0) & mask)) return true;
    }
  }
  return false;
};

// 2) Redis connection (prod) or memory (dev/tests)
const redisUrl = process.env.REDIS_URL;
const useRedis = !!redisUrl && process.env.NODE_ENV === 'production';
const redis = useRedis ? new Redis(redisUrl!, { maxRetriesPerRequest: 2, enableOfflineQueue: false }) : null;
// after: const redis = useRedis ? new Redis(...): null;
if (redis) {
  app.set('redis', redis);
  app.set('products_cache_ttl', 60); // 60 seconds cache
  app.set('products_cache_ns_key', 'products:ver');
  console.log('✅ Redis initialized');
}


const points = Number(process.env.RATE_LIMIT_POINTS ?? 6000);        // total tokens per window
const duration = Number(process.env.RATE_LIMIT_DURATION ?? 900);     // window seconds (15m)
const burstPoints = Number(process.env.RATE_LIMIT_BURST_POINTS ?? 150); // per-second burst
const burstDuration = Number(process.env.RATE_LIMIT_BURST_DURATION ?? 1);

// General window limiter (sliding window)
const windowLimiter = useRedis
  ? new RateLimiterRedis({ storeClient: redis!, keyPrefix: 'rlf:win', points, duration, execEvenly: true })
  : new RateLimiterMemory({ keyPrefix: 'rlf:win', points, duration });

// Short burst limiter (protects sudden spikes without hurting sustained flows)
const burstLimiter = useRedis
  ? new RateLimiterRedis({ storeClient: redis!, keyPrefix: 'rlf:burst', points: burstPoints, duration: burstDuration })
  : new RateLimiterMemory({ keyPrefix: 'rlf:burst', points: burstPoints, duration: burstDuration });

// Optional: per-route weights (heavier endpoints cost more tokens)
const weightTable: Array<{ test: (req: express.Request) => boolean; cost: number }> = [
  // Payments & orders are heavier
  { test: req => req.path.startsWith('/api/payment'), cost: 5 },
  { test: req => req.path.startsWith('/api/orders'), cost: 3 },
  { test: req => req.path.startsWith('/api/admin'), cost: 2 },
  // default weight below
];

const getWeight = (req: express.Request) => {
  for (const rule of weightTable) if (rule.test(req)) return rule.cost;
  return 1;
};

// Build limiter key: prefer user id when authenticated (fair to big B2B orgs behind NAT)
const keyFromReq = (req: express.Request) => {
  const userId = (req as any)?.user?.id || (req as any)?.user?._id;
  if (userId) return `u:${String(userId)}`;
  // fallback: IP (trust proxy already enabled)
  return `ip:${req.ip}`;
};

// Standard response headers
const setRateHeaders = (res: express.Response, rlRes?: { remainingPoints?: number; msBeforeNext?: number }, limitPoints = points, limitDuration = duration) => {
  if (!rlRes) return;
  const remaining = Math.max(0, (rlRes.remainingPoints ?? 0));
  const resetSec = Math.ceil((rlRes.msBeforeNext ?? 0) / 1000);
  res.setHeader('RateLimit-Policy', `sliding; window=${limitDuration}; burst=${burstPoints}`);
  res.setHeader('RateLimit-Limit', String(limitPoints));
  res.setHeader('RateLimit-Remaining', String(remaining));
  res.setHeader('RateLimit-Reset', String(resetSec));
};

// Paths to skip limiting entirely (health, debug, webhooks you trust, etc.)
const skipPaths = ['/api/health', '/api/debug', '/api/webhooks'];

// Middleware
const advancedRateLimit: express.RequestHandler = async (req, res, next) => {
  try {
    if (skipPaths.some(p => req.path.startsWith(p))) return next();
    if (isAllowlisted(req.ip)) return next();

    // Determine cost + key
    const cost = getWeight(req);
    const key = keyFromReq(req);

    // Burst check first (failing this means too spiky)
    try {
      const burstRes = await burstLimiter.consume(key, cost);
      setRateHeaders(res, burstRes as any, burstPoints, burstDuration);
    } catch (burstErr: any) {
      res.setHeader('Retry-After', Math.ceil((burstErr.msBeforeNext ?? 1000) / 1000));
      return res.status(429).json({
        error: 'Too many requests (burst)',
        hint: 'Spread requests more evenly or lower concurrency.',
        retryAfterSeconds: Math.ceil((burstErr.msBeforeNext ?? 1000) / 1000),
        requestId: (req as any).requestId,
      });
    }

    // Windowed budget
    try {
      const winRes = await windowLimiter.consume(key, cost);
      setRateHeaders(res, winRes as any, points, duration);
      return next();
    } catch (winErr: any) {
      res.setHeader('Retry-After', Math.ceil((winErr.msBeforeNext ?? 15_000) / 1000));
      return res.status(429).json({
        error: 'Too many requests',
        windowSeconds: duration,
        limit: points,
        retryAfterSeconds: Math.ceil((winErr.msBeforeNext ?? 15_000) / 1000),
        requestId: (req as any).requestId,
      });
    }
  } catch (e) {
    // In case Redis hiccups: fail-open for availability (B2B friendly)
    console.warn('⚠️ rate limit bypass due to internal error:', (e as Error).message);
    return next();
  }
};

// Apply to all API routes (keep above CORS)
app.use('/api', advancedRateLimit);
// put this ABOVE app.use(cors(...))
app.use((_, res, next) => {
  res.header('Vary', 'Origin');
  next();
});

// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (!isProd) return callback(null, true);
      console.warn(`❌ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization', 'x-requested-with'],
    optionsSuccessStatus: 200
  })
);

// Preflight
app.options('*', (req, res) => {
  const origin = req.get('Origin') || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-auth-token, Authorization, x-requested-with');
  res.sendStatus(204);
});

// Root
app.get('/', (_req, res): void => {
  res.json({
    message: 'Nakoda Mobile API with Socket.IO is running successfully! 🚀',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    features: ['Socket.IO', 'Real-time Updates', 'Admin Dashboard', 'Cloudinary Integration']
  });
});

// Parsers
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      if (buf.length > 1024 * 1024) {
        console.log(`📦 Large payload detected: ${buf.length} bytes on ${req.url}`);
      }
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Passport
app.use(passport.initialize());

// Logs
app.use(morgan(isProd ? 'combined' : 'dev'));

// Socket.IO rooms
io.on('connection', (socket: Socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('join', ({ role, userId }: { role?: string; userId?: string }) => {
    if (role === 'admin') socket.join('admins');
    if (userId) socket.join(userId);
  });

  socket.on('join-admin', () => socket.join('admins')); // legacy
  socket.on('join-user', (userId: string) => userId && socket.join(userId)); // legacy

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Attach io
app.use((req, _res, next) => {
  (req as any).io = io;
  next();
});
app.set('io', io);

// Cart logging
app.use('/api/cart', (req, res, next): void => {
  const start = Date.now();
  console.log(`🛒 Cart ${req.method}: ${req.path}`, {
    ip: req.ip,
    ua: (req.get('User-Agent') || '').slice(0, 50) + '...',
    hasAuth: !!req.get('Authorization'),
    requestId: (req as any).requestId
  });
  res.on('finish', () => {
    console.log(
      `🛒 Cart ${req.method} ${req.path} completed in ${Date.now() - start}ms with status ${res.statusCode}`
    );
  });
  next();
});

// /uploads static
app.use('/uploads', (req, _res, next) => {
  const fp = path.join(uploadsDir, req.path);
  console.log('📁 Upload request:', { requestPath: req.path, fullPath: fp, exists: fs.existsSync(fp) });
  next();
});
app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge: isProd ? '7d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      console.log('📸 Serving static file:', filePath);
    }
  })
);

// API Routes (public first)
app.use('/api/auth', authRoutes);
app.use('/api', phoneAuthRoutes)

app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/oem', oemRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/user', userRoutes);
app.use('/api', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api', shiprocketRoutes);
// Reviews router — mount once under /api
app.use('/api', reviewsPublic);
// Support/Help/Notifications/Returns
app.use('/api/help', helpRoutes);
app.use('/api/support', supportRouter);
app.use('/api', notificationRoutes);
app.use('/api', returnRoutes);
app.use('/api/webhooks', webhookRouter);
// Admin protected
app.use('/api/admin', adminRoutes);
import shippingRoutes from './routes/shipping';
app.use('/api/shipping', shippingRoutes);
// src/index.ts (or your app bootstrap)
import uploads from './routes/uploads';
app.use('/api/uploads', uploads);

// Shiprocket protected (single mount; no unprotected duplicate)
app.use('/api/shiprocket', authenticate, adminOnly, shiprocketRoutes);

// Health
app.get('/api/health', async (_req, res): Promise<void> => {
  let dbStatus = 'Unknown';
  try {
    const mongoose = require('mongoose');
    dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  } catch {
    dbStatus = 'Error';
  }

  // Cloudinary check (same as before)
  let cloudinaryStatus = isProd ? 'Skipped' : 'Unknown';
  if (!isProd) {
    try {
      const cloudinary = require('cloudinary').v2;
      await cloudinary.api.ping();
      cloudinaryStatus = 'Connected';
    } catch {
      cloudinaryStatus = 'Error';
    }
  }

  // ✅ NEW — Redis check
  const redisStatus = redis ? (redis.status === 'ready' ? 'Connected' : redis.status) : 'Disabled';

  const rateLimits = { max: isProd ? 1000 : 10000, window: '15 minutes' as const };
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: dbStatus,
    redis: redisStatus,        // ← added here
    cloudinary: cloudinaryStatus,
    socketIO: 'Enabled',
    rateLimits,
    routes: {
      auth: '/api/auth',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      payment: '/api/payment',
      oem: '/api/oem',
      admin: '/api/admin'
    }
  });
});
;

// DEV-ONLY TEST ENDPOINTS
if (!isProd) {
  app.get('/api/test/uploads', (_req, res) => {
    try {
      const exists = fs.existsSync(uploadsDir);
      const files = exists ? fs.readdirSync(uploadsDir) : [];
      res.json({
        success: true,
        uploadsDirectory: uploadsDir,
        exists,
        fileCount: files.length,
        sampleFiles: files.slice(0, 10),
        testUrls: files.slice(0, 3).map((f) => `http://localhost:5000/uploads/${f}`)
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, uploadsDirectory: uploadsDir });
    }
  });

  app.get('/api/test/cloudinary', async (_req, res) => {
    try {
      const cloudinary = require('cloudinary').v2;
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      console.log('📋 Cloudinary env:', {
        cloudName: cloudName ? 'SET' : 'MISSING',
        apiKey: apiKey ? 'SET' : 'MISSING',
        apiSecret: apiSecret ? 'SET' : 'MISSING' // do not log actual secret
      });

      if (!cloudName || !apiKey || !apiSecret) {
        return res.status(500).json({
          success: false,
          message: 'Missing Cloudinary environment variables'
        });
      }

      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
      const result = await cloudinary.api.ping();
      res.json({ success: true, message: 'Cloudinary OK', pingResult: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Cloudinary connection failed', error: error.message });
    }
  });

  app.post('/api/test/upload', async (_req, res) => {
    try {
      const { uploadProductImages } = require('./config/cloudinary');
      const testImageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      );
      const result = await uploadProductImages(testImageBuffer, `test-upload-${Date.now()}`, 'test-image.png');
      res.json({
        success: true,
        imageUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        size: result.bytes,
        width: result.width,
        height: result.height
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: 'Upload test failed', error: error.message });
    }
  });

  app.get('/api/test/razorpay', async (_req, res) => {
    try {
      const Razorpay = require('razorpay');
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

      const testOrder = await razorpay.orders.create({
        amount: 100, // ₹1.00
        currency: 'INR',
        receipt: `test_receipt_${Date.now()}`,
        notes: { test: true }
      });

      res.json({
        success: true,
        message: 'Razorpay connection successful! 🎉',
        testOrder: { id: testOrder.id, amount: testOrder.amount, currency: testOrder.currency, status: testOrder.status }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Razorpay connection failed',
        error: error.message
      });
    }
  });

  app.post('/api/test/email-service', async (_req, res) => {
    try {
      const EmailAutomationService = require('./services/emailService').default;
      const testOrder = {
        _id: 'test123',
        orderNumber: 'TEST001',
        total: 2499,
        subtotal: 2499,
        tax: 0,
        shipping: 0,
        items: [{ name: 'Test TWS Earbuds', quantity: 1, price: 2499, image: 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400' }],
        shippingAddress: {
          fullName: 'Test Customer',
          email: process.env.SMTP_USER,
          phoneNumber: '+919876543210',
          addressLine1: 'Test Address',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001'
        },
        paymentMethod: 'razorpay',
        orderStatus: 'confirmed',
        createdAt: new Date()
      };
      await EmailAutomationService.sendOrderConfirmation(testOrder, process.env.SMTP_USER);
      res.json({ success: true, message: 'Test order confirmation email sent!', sentTo: process.env.SMTP_USER });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

// Disable ETag if you prefer
app.set('etag', false);

// Errors
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction): void => {
  console.error('🚨 Error occurred:', {
    requestId: (req as any).requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
    userAgent: req.get('User-Agent')
  });

  if (err.name === 'ValidationError') {
    res.status(400).json({ success: false, message: 'Validation Error' });
    return;
  }
  if (err.name === 'CastError') {
    res.status(400).json({ success: false, message: 'Invalid ID format' });
    return;
  }
  if (err.code === 11000) {
    res.status(400).json({ success: false, message: 'Duplicate field value' });
    return;
  }
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, message: 'Token expired' });
    return;
  }
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ success: false, message: 'CORS policy violation' });
    return;
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: (req as any).requestId,
    ...(isProd ? {} : { stack: err.stack, details: err })
  });
});

// 404
app.use('*', (req, res): void => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: (req as any).requestId
  });
});

// Shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  io.close(() => {
    console.log('🔌 Socket.IO server closed');
    process.exit(0);
  });
});
process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  io.close(() => {
    console.log('🔌 Socket.IO server closed');
    process.exit(0);
  });
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});
const shutdown = async () => {
  console.log('🛑 Shutting down...');
  try { if (redis) await redis.quit(); } catch {}
  io.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start
server.listen(PORT, '0.0.0.0', () => {
  const base = isProd ? 'https://nakodamobile.com' : `http://localhost:${PORT}`;

  console.log('🚀 ================================');
  console.log('🚀 Nakoda Mobile API Server Started');
  console.log('🚀 ================================');
  console.log(`📡 Server bind: 0.0.0.0:${PORT}`)
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('🔐 PHONEPE ENV CHECK'), 
 

  // ✅ Public URLs (no :5000 when behind Nginx)
  console.log(`🔗 Public Base: ${base}`);
  console.log(`❤️  Health Check: ${base}/api/health`);
  console.log(`🛒 Cart API: ${base}/api/cart`);
  console.log(`📦 Products API: ${base}/api/products`);
  console.log(`🔐 Auth API: ${base}/api/auth`); // fixed .int -> .in
  console.log(`💳 Payment API: ${base}/api/payment`);
  console.log(`👨‍💼 Admin API: ${base}/api/admin`);
  console.log(`🔌 Socket.IO: ${base}/socket.io`);
  console.log(`📊 Rate Limit: ${isProd ? 1000 : 10000}/15m`);
  console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Not Configured'}`);
  if (!isProd) {
    console.log('🧪 Test Endpoints:');
    console.log('   - GET  /api/test/cloudinary');
    console.log('   - POST /api/test/upload');
    console.log('   - GET  /api/test/uploads');
    console.log('   - GET  /api/test/razorpay');
  }
  console.log('🚀 ================================');
});

export default app;
