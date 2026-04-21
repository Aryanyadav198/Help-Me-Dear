import { Router } from "express";
import {
  getAlertComments,
  updateComment,
  deleteComment,
} from "../controllers/comment.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

// Require token for all comment routes
router.use(verifyJwt);

// Get all comments for a specific alert
router.route("/alert/:alertId").get(getAlertComments);

// Update or Delete a specific comment
router.route("/:commentId")
  .patch(updateComment)
  .delete(deleteComment);

export default router;