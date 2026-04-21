import { Server } from "socket.io";

let io;

// userId (string) → Set of conversationIds currently open
const activeChats = new Map();

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // ── User joins a conversation room ──────────────────────────────────────
    socket.on("join_conversation", ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;

      socket.join(conversationId);
      socket.data.userId = userId;
      socket.data.conversationId = conversationId;

      if (!activeChats.has(userId)) activeChats.set(userId, new Set());
      activeChats.get(userId).add(conversationId);

      console.log(`👤 ${userId} joined room: ${conversationId}`);
    });

    // ── User leaves a conversation room ─────────────────────────────────────
    socket.on("leave_conversation", ({ conversationId, userId }) => {
      socket.leave(conversationId);
      activeChats.get(userId)?.delete(conversationId);
      console.log(`👤 ${userId} left room: ${conversationId}`);
    });

    // ── On disconnect, clean up ─────────────────────────────────────────────
    socket.on("disconnect", () => {
      const { userId, conversationId } = socket.data;
      if (userId && conversationId) {
        activeChats.get(userId)?.delete(conversationId);
        if (activeChats.get(userId)?.size === 0) activeChats.delete(userId);
      }
      console.log("❌ Socket disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => io;

/** Returns true if the user currently has this conversation screen open */
export const isUserActiveInConversation = (userId, conversationId) => {
  return (
    activeChats.get(userId.toString())?.has(conversationId.toString()) ?? false
  );
};