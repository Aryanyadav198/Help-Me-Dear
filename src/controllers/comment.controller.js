import { asyncHandler } from "../utils/async_handler.js";
import { ApiErrors } from "../utils/api_errors.js";
import { ApiResponse } from "../utils/api_response.js";
import { Comment } from "../models/comment.model.js";

// Helper function for time formatting
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return interval + "y ago";
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return interval + "mo ago";
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return interval + "d ago";
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + "h ago";
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + "m ago";
  return Math.floor(seconds) + "s ago";
};

// ─── GET ALL COMMENTS FOR AN ALERT ────────────────────────────
const getAlertComments = asyncHandler(async (req, res) => {
  const { alertId } = req.params;

  // Find comments and populate the user details (name and avatar)
  const comments = await Comment.find({ alert: alertId })
    .populate("user", "userName avatar")
    .sort({ createdAt: -1 }); // Newest first

  // Format the response for Flutter
  const formattedComments = comments.map((comment) => ({
    id: comment._id.toString(),
    content: comment.content,
    user_name: comment.user?.userName || "Unknown User",
    user_avatar: comment.user?.avatar || "",
    time_ago: timeAgo(comment.createdAt),
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, "Comments fetched successfully", formattedComments));
});

// ─── EDIT A COMMENT ───────────────────────────────────────────
const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content) throw new ApiErrors(400, "Content is required to update comment");

  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiErrors(404, "Comment not found");

  // Security check: Only the user who wrote the comment can edit it
  if (comment.user.toString() !== req.user._id.toString()) {
    throw new ApiErrors(403, "You do not have permission to edit this comment");
  }

  comment.content = content;
  await comment.save();

  return res
    .status(200)
    .json(new ApiResponse(200, "Comment updated successfully", comment));
});

// ─── DELETE A COMMENT ─────────────────────────────────────────
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);
  if (!comment) throw new ApiErrors(404, "Comment not found");

  // Security check: Only the user who wrote the comment can delete it
  if (comment.user.toString() !== req.user._id.toString()) {
    throw new ApiErrors(403, "You do not have permission to delete this comment");
  }

  await Comment.findByIdAndDelete(commentId);

  return res
    .status(200)
    .json(new ApiResponse(200, "Comment deleted successfully", {}));
});

export { getAlertComments, updateComment, deleteComment };