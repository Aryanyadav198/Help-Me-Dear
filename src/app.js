import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Routes
import userRouter from "./routes/user.routes.js";
import alertRouter from "./routes/alert.routes.js"; 
import commentRouter from "./routes/comment.routes.js"; 
import chatRouter  from "./routes/chat.routes.js";



app.use("/api/v1/users", userRouter);
app.use("/api/v1/alerts", alertRouter);
app.use("/api/v1/comments", commentRouter); 
app.use("/api/v1/chat",   chatRouter);


// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statuscode || 500;
  console.error("ACTUAL ERROR:", err.message);
  res.status(statusCode).json({
    success: false,
    message: err.message || "Something went wrong",
    data: {}
  });
});

export { app };