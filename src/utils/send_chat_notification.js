
import admin from "./firebase.js";
import { User } from "../models/user.model.js";

export const sendNotificationToUser = async ({
  userId,
  title,
  body,
  data = {},
}) => {
  try {
    const user = await User.findById(userId);

    if (!user?.fcmToken) {
      console.log("❌ No FCM token for user:", userId);
      return;
    }

    const message = {
      token: user.fcmToken,

      notification: {
        title,
        body,
      },

      // 🔥 IMPORTANT: data must be string only
      data: Object.fromEntries(
        Object.entries({
          ...data,
        }).map(([k, v]) => [k, String(v)])
      ),

      // 🔥 Android config (HIGH PRIORITY)
      android: {
        priority: "high",
        notification: {
          channelId: "high_importance_channel",
          sound: "default",
        },
      },

      // 🔥 iOS config
      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);

    console.log("✅ Notification sent:", response);
  } catch (error) {
    console.error("🔥 Notification error:", error);
  }
};