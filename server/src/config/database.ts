// src/config/database.ts
import mongoose from 'mongoose';
import { createClient, type RedisClientType } from 'redis';

export const connectDatabase = async () => {
  await mongoose.connect(process.env.MONGODB_URI!, {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  console.log('✅ MongoDB Connected');
};

// ---- Redis
export const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  // username/password if needed:
  // username: process.env.REDIS_USERNAME,
  // password: process.env.REDIS_PASSWORD,
});

redis.on('connect', () => console.log('✅ Redis Connected'));
redis.on('error', (err) => console.error('❌ Redis Client Error:', err));

export const connectRedis = async () => {
  if (!redis.isOpen) await redis.connect();
  await redis.ping(); // quick health check
};
