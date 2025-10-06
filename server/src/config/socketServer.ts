// src/config/socket.ts (production-ready)
import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";

let io: Server | null = null;

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

/** Comma-separated list; include both apex & www in prod */
const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGINS ??
  "https://nakodamobile.com,https://www.nakodamobile.com,http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type JoinPayload = { role?: "admin" | "user"; userId?: string };

export function initSocket(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin(origin, cb) {
        if (!origin) return cb(null, true);               // SSR / curl / healthchecks
        if (FRONTEND_ORIGINS.includes(origin)) return cb(null, true);
        if (!isProd) return cb(null, true);               // be lenient in dev
        return cb(new Error(`Not allowed by Socket.IO CORS: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    allowEIO3: false,
    pingTimeout: 20_000,
    pingInterval: 25_000,
  });

  // ---- Optional auth (enable with SOCKET_REQUIRE_AUTH=true) ----
  const requireAuth = process.env.SOCKET_REQUIRE_AUTH === "true";

  io.use((socket, next) => {
    if (!requireAuth) return next();
    try {
      const token =
        socket.handshake.auth?.token ||
        extractCookie(socket.handshake.headers.cookie, "access_token");
      if (!token) return next(new Error("Unauthorized"));
      const secret = process.env.JWT_SECRET;
      if (!secret) return next(new Error("Server misconfigured (no JWT_SECRET)"));
      const payload = jwt.verify(token, secret);
      (socket.data as any).user = payload;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    if (!isProd) console.log("🔌 socket connected:", socket.id);

    // idempotent room flags
    socket.data.joinedAdmin = false as boolean;
    socket.data.joinedUserId = null as string | null;

    socket.on("join", ({ role, userId }: JoinPayload = {}) => {
      if (role === "admin" && !socket.data.joinedAdmin) {
        socket.join("admins");
        socket.data.joinedAdmin = true;
        if (!isProd) console.log("👑 joined admins:", socket.id);
        io!.to(socket.id).emit("admin:joined", { id: socket.id });
      }

      if (userId && socket.data.joinedUserId !== userId) {
        if (socket.data.joinedUserId) socket.leave(socket.data.joinedUserId);
        socket.join(userId);
        socket.data.joinedUserId = userId;
        if (!isProd) console.log("👤 joined user room:", userId, socket.id);
      }
    });

    // legacy shims (idempotent)
    socket.on("join-admin", () => {
      if (!socket.data.joinedAdmin) {
        socket.join("admins");
        socket.data.joinedAdmin = true;
        if (!isProd) console.log("👑 joined admins (legacy):", socket.id);
      }
    });

    socket.on("join-user", (payload: { userId?: string } | string) => {
      const userId = typeof payload === "string" ? payload : payload?.userId;
      if (userId && socket.data.joinedUserId !== userId) {
        if (socket.data.joinedUserId) socket.leave(socket.data.joinedUserId);
        socket.join(userId);
        socket.data.joinedUserId = userId;
        if (!isProd) console.log("👤 joined user room (legacy):", userId, socket.id);
      }
    });

    socket.on("disconnect", (reason) => {
      if (!isProd) console.log("🔌 socket disconnected:", socket.id, reason);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized yet");
  return io;
}

/** Handy emitters (use from controllers/services) */
export const events = {
  orderCreated: (order: any) => getIO().to("admins").emit("orderCreated", order),
  orderStatusUpdated: (order: any) => getIO().to("admins").emit("orderStatusUpdated", order),
  notifyUser: (userId: string, payload: any) => getIO().to(userId).emit("notify", payload),
};

/* ------------------------------- helpers -------------------------------- */
function extractCookie(cookieHeader?: string, name?: string) {
  if (!cookieHeader || !name) return undefined;
  const found = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((c) => c.startsWith(name + "="));
  return found?.split("=").slice(1).join("=");
}
