import mongoose, { Schema } from "mongoose";

const dislikeSchema = new Schema({

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
  },
  { timestamps: true }
);

export const Dislike = mongoose.model("Dislike", dislikeSchema);