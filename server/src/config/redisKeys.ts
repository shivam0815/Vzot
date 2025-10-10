export const cartKey = (userId?: string, sid?: string) =>
  userId ? `cart:user:${userId}` : `cart:guest:${sid}`;

export const wishlistKey = (userId?: string, sid?: string) =>
  userId ? `wishlist:user:${userId}` : `wishlist:guest:${sid}`;

export const GUEST_TTL_SECONDS = 30 * 24 * 60 * 60; // 30d
