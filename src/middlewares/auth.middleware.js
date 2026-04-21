import jwt from "jsonwebtoken";
import { ApiErrors } from "../utils/api_errors.js";
import { asyncHandler } from "../utils/async_handler.js";
import { User } from "../models/user.model.js";

const verifyJwt = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from header
  if (req.header("Authorization")?.startsWith("Bearer ")) {
    token = req.header("Authorization").replace("Bearer ", "");
  }

  // ❌ No token
  if (!token) {
    throw new ApiErrors(401, "Unauthorized: Token required");
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (error) {
    // ❌ Invalid token (malformed / expired)
    throw new ApiErrors(401, "Invalid or expired token");
  }

  const user = await User.findById(decoded?._id).select("-password");

  if (!user) {
    throw new ApiErrors(401, "User not found");
  }

  req.user = user;
  next();
});

export { verifyJwt };