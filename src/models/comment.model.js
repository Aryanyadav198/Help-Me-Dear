import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema(
  {
    alert: {
      type: Schema.Types.ObjectId,
      ref: "Alert",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Comment = mongoose.model("Comment", commentSchema);