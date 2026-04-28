import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
  {
    userName: {
      type: String,
    //   required: true,
    //   unique: true,
      trim: true,
    //   lowercase: true,
    //   index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // allows null if phone is used
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // allows null if email is used
    },
    avatar: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      required: true,
    },
    fcmToken:{
        type: String
    }
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
  
    this.password = await bcrypt.hash(this.password, 10);
  });

// Compare password
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate Access Token (no refresh token)
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      userName: this.userName,
      fullName: this.fullName,
      email: this.email,
      phone: this.phone,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

export const User = mongoose.model("User", userSchema);