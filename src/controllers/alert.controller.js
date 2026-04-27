import mongoose from "mongoose";
import { asyncHandler } from "../utils/async_handler.js";
import { ApiErrors } from "../utils/api_errors.js";
import { ApiResponse } from "../utils/api_response.js";
import { Alert } from "../models/alert.model.js";
import { Like } from "../models/like.model.js";
import {Dislike} from "../models/dislike.model.js";
import { Comment } from "../models/comment.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import { sendNotificationToAllUsers } from "../utils/sendNotification.js";


// Helper function to calculate timeAgo exactly as Flutter expects
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

// ─── CREATE ALERT ──────────────────────────────────────────────
const createAlert = asyncHandler(async (req, res) => {
  // 1. Extract lat and lng from the request body
  console.log("create alert called ");
  const { severity, location, lat, lng, description } = req.body;

  // 2. Validate all fields including coordinates
  if (!severity || !location || !lat || !lng ) {
    throw new ApiErrors(400, "Severity, location, lat, lng, and description are required");
  }

  if (!req.file?.path) {
    throw new ApiErrors(400, "Evidence image is required");
  }

  const uploadedImage = await uploadOnCloudinary(req.file.path);
  if (!uploadedImage?.url) {
    throw new ApiErrors(500, "Error uploading image to Cloudinary");
  }

  // 3. Save coordinates as floats
  const alert = await Alert.create({
    user: req.user._id,
    severity,
    location,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    description,
    imageUrl: uploadedImage.url,
  });
  await sendNotificationToAllUsers({
    title: "🚨 New Alert",
    body: `${location} - ${severity}`,
    data: {
      type: "alert",
      alertId: alert._id.toString(),
    },
  });

  return res.status(201).json(new ApiResponse(201, "Alert posted successfully", alert));
});
const sendTestNotification = asyncHandler(async (req, res) => {
    const { title, body, alertId } = req.body;
  
    await sendNotificationToAllUsers({
      title: title || "Test Notification",
      body: body || "This is a test",
      data: {
        type: "alert",
        alertId: alertId || "123",
      },
    });
  
    return res
      .status(200)
      .json(new ApiResponse(200, "Notification sent", {}));
  });

// ─── GET ALL ALERTS (Formatted for Flutter) ────────────────────
const getAllAlerts = asyncHandler(async (req, res) => {
  // We use aggregation to join users, likes, and comments efficiently
  const alerts = await Alert.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "author",
      },
    },
    { $unwind: "$author" },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "alert",
        as: "likesData",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "alert",
        as: "commentsData",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likesData" },
        commentsCount: { $size: "$commentsData" },
      },
    },
    { $sort: { createdAt: -1 } }, // Newest first
  ]);

  // Format exactly to Flutter model requirements, including lat and lng
  const formattedAlerts = alerts.map((alert) => ({
    id: alert._id.toString(),
    user_name: alert.author.userName,
    user_avatar: alert.author.avatar || "", 
    time_ago: timeAgo(alert.createdAt),
    severity: alert.severity,
    image_url: alert.imageUrl,
    location: alert.location,
    lat: alert.lat, // Added lat mapped directly from DB
    lng: alert.lng, // Added lng mapped directly from DB
    description: alert.description,
    likes: alert.likesCount,
    comments: alert.commentsCount,
  }));

  return res.status(200).json(new ApiResponse(200, "Alerts fetched", formattedAlerts));
});

// ─── GET ALERT DETAIL ─────────────────────────────────────────
const getAlertDetail = asyncHandler(async (req, res) => {
    const { alertId } = req.params;
  
    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      throw new ApiErrors(400, "Invalid alert ID");
    }
  
    const userId = new mongoose.Types.ObjectId(req.user._id);
  
    const alertData = await Alert.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(alertId),
        },
      },
  
      // 🔹 Get author
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: "$author" },
  
      // 🔹 Likes
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "alert",
          as: "likesData",
        },
      },
  
      // 🔹 Dislikes
      {
        $lookup: {
          from: "dislikes",
          localField: "_id",
          foreignField: "alert",
          as: "dislikesData",
        },
      },
  
      // 🔹 Comments with user info
      {
        $lookup: {
          from: "comments",
          let: { alertId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$alert", "$$alertId"] },
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "commentUser",
              },
            },
            { $unwind: "$commentUser" },
            {
              $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                user_name: "$commentUser.userName",
                user_avatar: "$commentUser.avatar",
              },
            },
          ],
          as: "commentsData",
        },
      },
  
      // 🔥 FINAL CALCULATIONS (ONLY ONE addFields)
      {
        $addFields: {
          likes: { $size: { $ifNull: ["$likesData", []] } },
          dislikes: { $size: { $ifNull: ["$dislikesData", []] } },
          commentsCount: { $size: { $ifNull: ["$commentsData", []] } },
  
          isLiked: {
            $in: [
              userId,
              {
                $map: {
                  input: { $ifNull: ["$likesData", []] },
                  as: "like",
                  in: "$$like.user",
                },
              },
            ],
          },
  
          isDisliked: {
            $in: [
              userId,
              {
                $map: {
                  input: { $ifNull: ["$dislikesData", []] },
                  as: "dislike",
                  in: "$$dislike.user",
                },
              },
            ],
          },
        },
      },
    ]);
  
    if (!alertData.length) {
      throw new ApiErrors(404, "Alert not found");
    }
  
    const alert = alertData[0];
  
    // 🔹 Format response for Flutter
    const formattedResponse = {
      alert: {
        id: alert._id.toString(),
        user_id: alert.user.toString(),
        user_name: alert.author.userName,
        user_avatar: alert.author.avatar || "",
        time_ago: timeAgo(alert.createdAt),
        severity: alert.severity,
        image_url: alert.imageUrl,
        location: alert.location,
        description: alert.description,
        likes: alert.likes,
        comments: alert.commentsCount,
  
        // ✅ NEW FIELDS
        isLiked: alert.isLiked,
        isDisliked: alert.isDisliked,
      },
  
      full_description: alert.description,
      address: alert.location,
      coordinates: `${alert.lat}, ${alert.lng}`,
      dislikes: alert.dislikes,
  
      comments: (alert.commentsData || []).map((c) => ({
        id: c._id.toString(),
        user_name: c.user_name,
        user_avatar: c.user_avatar || "",
        time_ago: timeAgo(c.createdAt),
        text: c.content,
      })),
    };
  
    return res
      .status(200)
      .json(new ApiResponse(200, "Alert detail fetched", formattedResponse));
  });

// ─── DELETE ALERT ──────────────────────────────────────────────
const deleteAlert = asyncHandler(async (req, res) => {
  const { alertId } = req.params;

  const alert = await Alert.findById(alertId);
  if (!alert) throw new ApiErrors(404, "Alert not found");

  // Ensure only the owner can delete it
  if (alert.user.toString() !== req.user._id.toString()) {
    throw new ApiErrors(403, "You do not have permission to delete this alert");
  }

  await Alert.findByIdAndDelete(alertId);
  // Cleanup related likes and comments
  await Like.deleteMany({ alert: alertId });
  await Comment.deleteMany({ alert: alertId });

  return res.status(200).json(new ApiResponse(200, "Alert deleted successfully", {}));
});

// ─── TOGGLE LIKE ───────────────────────────────────────────────
const toggleLikeAlert = asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const userId = req.user._id;
  
    const existingLike = await Like.findOne({
      alert: alertId,
      user: userId,
    });
  
    if (existingLike) {
      // ❌ Already liked → remove like
      await Like.findByIdAndDelete(existingLike._id);
  
      return res
        .status(200)
        .json(new ApiResponse(200, "Alert unliked", { isLiked: false }));
    }
  
    // ✅ Remove dislike if exists (IMPORTANT)
    await Dislike.deleteOne({
      alert: alertId,
      user: userId,
    });
  
    // ✅ Add like
    await Like.create({
      alert: alertId,
      user: userId,
    });
  
    return res.status(200).json(
      new ApiResponse(200, "Alert liked", {
        isLiked: true,
        isDisliked: false, // 🔥 send this also
      })
    );
  });

// ----- TOGGLE Dislike -------------------------------------------
const toggleDislikeAlert = asyncHandler(async (req, res) => {
    const { alertId } = req.params;
    const userId = req.user._id;
  
    const existingDislike = await Dislike.findOne({
      alert: alertId,
      user: userId,
    });
  
    if (existingDislike) {
      // ❌ Already disliked → remove dislike
      await Dislike.findByIdAndDelete(existingDislike._id);
  
      return res.status(200).json(
        new ApiResponse(200, "Alert undisliked", {
          isDisliked: false,
        })
      );
    }
  
    // ✅ Remove like if exists (IMPORTANT)
    await Like.deleteOne({
      alert: alertId,
      user: userId,
    });
  
    // ✅ Add dislike
    await Dislike.create({
      alert: alertId,
      user: userId,
    });
  
    return res.status(200).json(
      new ApiResponse(200, "Alert disliked", {
        isDisliked: true,
        isLiked: false, // 🔥 send this also
      })
    );
  });// ─── ADD COMMENT ───────────────────────────────────────────────
const addComment = asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const { content } = req.body;

  if (!content) throw new ApiErrors(400, "Comment content is required");

  const comment = await Comment.create({
    alert: alertId,
    user: req.user._id,
    content,
  });

  return res.status(201).json(new ApiResponse(201, "Comment added", comment));
});

export {
  createAlert,
  getAllAlerts,
  getAlertDetail,
  deleteAlert,
  toggleLikeAlert,
  toggleDislikeAlert,
  addComment,
  sendTestNotification
};