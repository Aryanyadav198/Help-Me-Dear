// import admin from "firebase-admin";
// import path from "path";
// import { fileURLToPath } from "url";

// // Fix __dirname for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Path to your service account
// const serviceAccount = path.join(
//   __dirname,
//   "../pizza--delivery-firebase-adminsdk-84efu-761b044e41.json"
// );

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// export default admin;
import admin from "firebase-admin";

// 🔥 Parse service account JSON from ENV
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;