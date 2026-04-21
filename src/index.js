// import dotenv from "dotenv";
// dotenv.config({ path: "./.env" });

// import connectDb from "./db/index.js";
// import { app } from "./app.js";
// // 

// connectDb()
//   .then(() => {
//     app.listen(process.env.PORT || 8000, () => {
//       console.log(`✅ Server running on PORT: ${process.env.PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.error("❌ DB connection failed. Server not started.", err);
//     process.exit(1);
//   });
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import connectDb from "./db/index.js";
import { app } from "./app.js";
import { createServer } from "http";
import { initSocket } from "./utils/socket.js";

const httpServer = createServer(app); // 🔥 wrap express

connectDb()
  .then(() => {
    // 🔥 attach socket BEFORE listen
    initSocket(httpServer);

    httpServer.listen(process.env.PORT || 8000, () => {
      console.log(`✅ Server running on PORT: ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection failed. Server not started.", err);
    process.exit(1);
  });