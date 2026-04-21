import mongoose, { Schema } from "mongoose";

const alertSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    severity: {
      type: String,
      enum: ['urgent', 'minor', 'hazard'],
      required: true,
    },
    imageUrl: {
      type: String,
      required: true, 
    },
    location: {
      type: String, // Keep this for the human-readable address (e.g., "Delhi")
      required: true,
      trim: true,
    },
    lat: {
      type: Number, // Latitude
      required: true,
    },
    lng: {
      type: Number, // Longitude
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Alert = mongoose.model("Alert", alertSchema);