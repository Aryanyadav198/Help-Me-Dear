
import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { Alert } from "../models/alert.model.js";
import { ApiErrors } from "../utils/api_errors.js";
import { ApiResponse } from "../utils/api_response.js";
import { asyncHandler } from "../utils/async_handler.js";
import { sendNotificationToUser } from "../utils/send_chat_notification.js";
import { User } from "../models/user.model.js";
import { getIO, isUserActiveInConversation } from "../utils/socket.js"; // ← NEW

// ─── Helper ───────────────────────────────────────────────────────────────────
const getTimeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// ─── START / GET CONVERSATION ─────────────────────────────────────────────────
const startOrGetConversation = asyncHandler(async (req, res) => {
  const { alertId, receiverId } = req.body;
  const senderId = req.user._id;

  if (!alertId || !receiverId) throw new ApiErrors(400, "alertId and receiverId are required");
  if (senderId.toString() === receiverId.toString()) throw new ApiErrors(400, "You cannot chat with yourself");

  const alert = await Alert.findById(alertId);
  if (!alert) throw new ApiErrors(404, "Alert post not found");

  let conversation = await Conversation.findOne({
    post: alertId,
    members: { $all: [senderId, receiverId] },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      members: [senderId, receiverId],
      post: alertId,
      unreadCount: {
        [senderId.toString()]: 0,
        [receiverId.toString()]: 0,
      },
    });
  }

  const populated = await Conversation.findById(conversation._id)
    .populate("members", "userName avatar")
    .populate("post", "description severity location");

  return res.status(200).json(new ApiResponse(200, "Conversation ready", populated));
});

// ─── GET MY CONVERSATIONS ─────────────────────────────────────────────────────
const getMyConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const conversations = await Conversation.find({ members: userId })
    .populate("members", "userName avatar")
    .populate("post", "description severity location images")
    .sort({ lastMessageAt: -1 });

  const formatted = conversations.map((convo) => {
    const otherMember = convo.members.find((m) => m._id.toString() !== userId.toString());
    return {
      id: convo._id.toString(),
      other_user_id: otherMember?._id.toString() || "",
      other_user_name: otherMember?.userName || "",
      other_user_avatar: otherMember?.avatar || "",
      last_message: convo.lastMessage || "",
      time_ago: convo.lastMessageAt ? getTimeAgo(convo.lastMessageAt) : "",
      unread_count: convo.unreadCount?.get(userId.toString()) || 0,
      post: {
        id: convo.post?._id?.toString() || "",
        description: convo.post?.description || "",
        severity: convo.post?.severity || "",
        location: convo.post?.location || "",
        image_url: convo.post?.images?.[0] || "",
      },
    };
  });

  return res.status(200).json(new ApiResponse(200, "Conversations fetched", formatted));
});

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { text, type } = req.body;
  const senderId = req.user._id;

  if (!text?.trim()) throw new ApiErrors(400, "Message text is required");

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiErrors(404, "Conversation not found");

  const isMember = conversation.members.some((m) => m.toString() === senderId.toString());
  if (!isMember) throw new ApiErrors(403, "You are not part of this conversation");

  const message = await Message.create({
    conversation: conversationId,
    sender: senderId,
    text: text.trim(),
    type: type || "text",
  });

  // Update conversation metadata
  const otherMember = conversation.members.find((m) => m.toString() !== senderId.toString());
  const currentUnread = conversation.unreadCount?.get(otherMember.toString()) || 0;

  conversation.lastMessage = text.trim();
  conversation.lastMessageAt = new Date();
  conversation.unreadCount.set(otherMember.toString(), currentUnread + 1);
  await conversation.save();

  const sender = await User.findById(senderId);

  const populated = await Message.findById(message._id).populate("sender", "userName avatar");

  // ── Format message payload (shared by socket + REST response) ──────────────
  const messagePayload = {
    id: populated._id.toString(),
    conversation_id: conversationId,
    sender_id: populated.sender._id.toString(),
    sender_name: populated.sender.userName,
    sender_avatar: populated.sender.avatar || "",
    text: populated.text,
    type: populated.type,
    is_mine: false,          // receiver sees it as "not mine"
    time_ago: getTimeAgo(populated.createdAt),
    is_read: populated.isRead,
  };

  // ── 🔌 Emit to socket room (real-time delivery) ─────────────────────────────
  getIO()?.to(conversationId).emit("new_message", messagePayload);

  // ── 🔔 Push notification ONLY if receiver is NOT in the chat room ───────────
  const receiverIsActive = isUserActiveInConversation(otherMember.toString(), conversationId);

  if (!receiverIsActive) {
    await sendNotificationToUser({
      userId: otherMember,
      title: sender.userName,
      body: text.trim(),
      data: {
        type: "chat",
        conversationId: conversationId,
        alertId: conversation.post.toString(),
        senderId: senderId.toString(),
      },
    });
  } else {
    console.log("📵 Receiver is active in chat — skipping FCM notification");
  }

  // Return to sender (is_mine: true for sender's own view)
  return res.status(201).json(
    new ApiResponse(201, "Message sent", { ...messagePayload, is_mine: true })
  );
});

// ─── GET MESSAGES ─────────────────────────────────────────────────────────────
const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw new ApiErrors(404, "Conversation not found");

  const isMember = conversation.members.some((m) => m.toString() === userId.toString());
  if (!isMember) throw new ApiErrors(403, "Access denied");

  const messages = await Message.find({ conversation: conversationId })
    .populate("sender", "userName avatar")
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit);

  await Message.updateMany(
    { conversation: conversationId, sender: { $ne: userId }, isRead: false },
    { $set: { isRead: true } }
  );

  conversation.unreadCount.set(userId.toString(), 0);
  await conversation.save();

  const formatted = messages.map((m) => ({
    id: m._id.toString(),
    conversation_id: conversationId,
    sender_id: m.sender._id.toString(),
    sender_name: m.sender.userName,
    sender_avatar: m.sender.avatar || "",
    text: m.text,
    type: m.type,
    is_mine: m.sender._id.toString() === userId.toString(),
    time_ago: getTimeAgo(m.createdAt),
    is_read: m.isRead,
  }));

  return res.status(200).json(
    new ApiResponse(200, "Messages fetched", {
      messages: formatted,
      pagination: { page, limit },
    })
  );
});

// ─── DELETE MESSAGE ───────────────────────────────────────────────────────────
const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findById(messageId);
  if (!message) throw new ApiErrors(404, "Message not found");

  if (message.sender.toString() !== userId.toString()) {
    throw new ApiErrors(403, "You can only delete your own messages");
  }

  // Notify the room that this message was deleted
  getIO()?.to(message.conversation.toString()).emit("message_deleted", {
    message_id: messageId,
    conversation_id: message.conversation.toString(),
  });

  await Message.findByIdAndDelete(messageId);

  return res.status(200).json(new ApiResponse(200, "Message deleted", {}));
});

export {
  startOrGetConversation,
  getMyConversations,
  sendMessage,
  getMessages,
  deleteMessage,
};