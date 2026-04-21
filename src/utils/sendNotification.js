import admin from "./firebase.js";
import { User } from "../models/user.model.js";

export const sendNotificationToAllUsers = async ({
  title,
  body,
  data = {},
}) => {
  try {
    // Get all users with FCM tokens
    const users = await User.find({
      fcmToken: { $exists: true, $ne: null },
    });

    const tokens = users.map((u) => u.fcmToken);

    if (!tokens.length) {
      console.log("No FCM tokens found");
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log("✅ Notifications sent:", response.successCount);
    console.log("❌ Failed:", response.failureCount);
  } catch (error) {
    console.error("🔥 Notification error:", error);
  }
};