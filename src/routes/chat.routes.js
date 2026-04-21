import { Router } from "express";
import {
  startOrGetConversation,
  getMyConversations,
  sendMessage,
  getMessages,
  deleteMessage,
} from "../controllers/chat.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

// ── Conversations ────────────────────────────────────────────
router.post("/conversations/start",  verifyJwt, startOrGetConversation);
router.get("/conversations",         verifyJwt, getMyConversations);

// ── Messages ─────────────────────────────────────────────────
router.post("/conversations/:conversationId/messages",  verifyJwt, sendMessage);
router.get("/conversations/:conversationId/messages",   verifyJwt, getMessages);
router.delete("/messages/:messageId",                   verifyJwt, deleteMessage);

export default router;