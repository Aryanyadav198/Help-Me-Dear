import { asyncHandler } from "../utils/async_handler.js";
import { ApiErrors } from "../utils/api_errors.js";
import { ApiResponse } from "../utils/api_response.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import mongoose from "mongoose";
import { Alert } from "../models/alert.model.js";

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

// ─── REGISTER ────────────────────────────────────────────────
const registerUser = asyncHandler(async (req, res) => {
    
  const { userName, fullName, email, phone, password } = req.body;

  // Must have either email or phone
  if (!email && !phone) {
    throw new ApiErrors(400, "Either email or phone number is required");
  }
  if (!userName || !fullName || !password) {
    throw new ApiErrors(400, "userName, fullName, and password are required");
  }

  // Check duplicates
  const orQuery = [{ userName }];
  if (email) orQuery.push({ email });
  if (phone) orQuery.push({ phone });

  const existing = await User.findOne({ $or: orQuery });
  if (existing) {
    if (existing.userName === userName)
      throw new ApiErrors(409, "Username already taken");
    if (email && existing.email === email)
      throw new ApiErrors(409, "Email already registered");
    if (phone && existing.phone === phone)
      throw new ApiErrors(409, "Phone number already registered");
  }

  // Avatar upload (optional)
  let avatarUrl = "";
  if (req.file?.path) {
    const uploaded = await uploadOnCloudinary(req.file.path);
    if (uploaded) avatarUrl = uploaded.url;
  }

  const user = await User.create({
    userName: userName.toLowerCase(),
    fullName,
    email: email || undefined,
    phone: phone || undefined,
    avatar: avatarUrl,
    password,
  });

  const createdUser = await User.findById(user._id).select("-password");
  const accessToken = user.generateAccessToken();
  return res
    .status(201)
    .json(new ApiResponse(201, "User registered successfully", {
        "user": createdUser,
        accessToken
    }));
});

// ─── LOGIN ────────────────────────────────────────────────────
const loginUser = asyncHandler(async (req, res) => {
  const { email, phone, userName, password } = req.body;

  /// user can login without password 
//   if (!password) throw new ApiErrors(400, "Password is required");

  if (!email && !phone && !userName) {
    throw new ApiErrors(400, "Provide email, phone, or userName to login");
  }

  // Build query
  const orQuery = [];
  if (email) orQuery.push({ email });
  if (phone) orQuery.push({ phone });
  if (userName) orQuery.push({ userName: userName.toLowerCase() });

  const user = await User.findOne({ $or: orQuery });
  if (!user) throw new ApiErrors(404, "User not found");

//   const isValid = await user.isPasswordCorrect(password);
//   if (!isValid) throw new ApiErrors(401, "Invalid credentials");

  const accessToken = user.generateAccessToken();

  const loggedInUser = await User.findById(user._id).select("-password");

  const cookieOptions = { httpOnly: true, secure: true };

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .json(
      new ApiResponse(200, "Login successful", {
        user: loggedInUser,
        accessToken,
      })
    );
});

// ─── LOGOUT ───────────────────────────────────────────────────
const logoutUser = asyncHandler(async (req, res) => {
  const cookieOptions = { httpOnly: true, secure: true };
  res.clearCookie("accessToken", cookieOptions);
  return res
    .status(200)
    .json(new ApiResponse(200, "Logged out successfully", {}));
});

// ---- Save Fcm Token -------------------------------------
const saveFcmToken = asyncHandler(async (req, res) => {
    const { fcmToken } = req.body;
  
    if (!fcmToken) {
      throw new ApiErrors(400, "FCM token is required");
    }
    if (req.user.fcmToken === fcmToken) {
        return res.status(200).json(
          new ApiResponse(200, "FCM token already up to date", {})
        );
    }
  
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { fcmToken } },
      { new: true }
    ).select("-password");
  
    if (!user) {
      throw new ApiErrors(404, "User not found");
    }
  
    return res.status(200).json(
      new ApiResponse(200, "FCM token saved successfully", {
        fcmToken: user.fcmToken,
      })
    );
  });

// ─── GET PROFILE ──────────────────────────────────────────────
// const getUserProfile = asyncHandler(async (req, res) => {
//   const user = await User.findById(req.user._id).select("-password");
//   return res.status(200).json(new ApiResponse(200, "User profile", user));
// });
// Make sure you import mongoose and the Alert model at the top of your user.controller.js file!
// import mongoose from "mongoose";
// import { Alert } from "../models/alert.model.js";

// You will also need to bring over the `timeAgo` helper function into this file 
// if it isn't already globally accessible.

const getUserProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Fetch basic user details
  const user = await User.findById(userId).select("-password");
  if (!user) throw new ApiErrors(404, "User not found");

  // 2. Fetch all alerts created by the user with like & comment counts
  const userAlerts = await Alert.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
      },
    },
    // Lookup Likes
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "alert",
        as: "likesData",
      },
    },
    // Lookup Comments
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "alert",
        as: "commentsData",
      },
    },
    // Add counts
    {
      $addFields: {
        likesCount: { $size: "$likesData" },
        commentsCount: { $size: "$commentsData" },
      },
    },
    { $sort: { createdAt: -1 } }, // Newest first
  ]);

  // 3. Calculate statistics dynamically
  const totalPosts = userAlerts.length;
  const totalLikesReceived = userAlerts.reduce((sum, alert) => sum + alert.likesCount, 0);

  // Simple logic for gamification (you can adjust this later)
  const level = Math.floor(totalPosts / 5) + 1; // +1 level for every 5 posts
  const helpedCases = Math.floor(totalPosts / 2); // Mock metric

  // 4. Format post history to match Flutter model exactly
  const postHistory = userAlerts.map((alert) => {
    // Map severity to Flutter tag and tag_color
    let tag = "Informational";
    let tagColor = "secondary";

    if (alert.severity === "urgent") {
      tag = "High Priority";
      tagColor = "error";
    } else if (alert.severity === "hazard") {
      tag = "Road Hazard";
      tagColor = "primary";
    } else if (alert.severity === "minor") {
      tag = "Minor Issue";
      tagColor = "secondary";
    }

    return {
      id: alert._id.toString(),
      tag: tag,
      tag_color: tagColor,
      time_ago: timeAgo(alert.createdAt), // ensure timeAgo is available in this file
      title: alert.location, // Using location as the title (since Alert lacks a 'title' field)
      description: alert.description,
      image_url: alert.imageUrl || null,
      likes: alert.likesCount,
      comments: alert.commentsCount,
    };
  });

  // 5. Construct final JSON response
  const profileData = {
    id: user._id.toString(),
    name: user.fullName,
    email: user.email,
    phone: user.phone,
    role: "Tactical Responder", // Hardcoded default, or add 'role' to your User schema later
    level: level,
    avatar_url: user.avatar || "",
    posts: totalPosts,
    likes_received: totalLikesReceived,
    helped_cases: helpedCases,
    post_history: postHistory,
  };

  return res.status(200).json(new ApiResponse(200, "User profile fetched", profileData));
});

// ─── UPDATE ACCOUNT ───────────────────────────────────────────
const updateUserAccount = asyncHandler(async (req, res) => {
  const { fullName, email, phone } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { fullName, email, phone } },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, "Account updated", user));
});

// ─── UPDATE AVATAR ────────────────────────────────────────────
const updateUserAvatar = asyncHandler(async (req, res) => {
  if (!req.file?.path) throw new ApiErrors(400, "Avatar image required");

  const uploaded = await uploadOnCloudinary(req.file.path);
  if (!uploaded?.url) throw new ApiErrors(500, "Cloudinary upload failed");

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { avatar: uploaded.url } },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, "Avatar updated", user));
});

// ─── CHANGE PASSWORD ──────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword)
    throw new ApiErrors(400, "Both old and new password required");

  const user = await User.findById(req.user._id);
  const isCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isCorrect) throw new ApiErrors(400, "Old password is incorrect");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully", {}));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  updateUserAccount,
  updateUserAvatar,
  changePassword,
  saveFcmToken
};