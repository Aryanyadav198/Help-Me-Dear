import { Router } from "express";
import {
  createAlert,
  getAllAlerts,
  getAlertDetail,
  deleteAlert,
  toggleLikeAlert,
  toggleDislikeAlert,
  addComment,
  sendTestNotification
} from "../controllers/alert.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

// Secure all alert routes
router.use(verifyJwt);

// Alert CRUD routes
router.route("/")
  .post(upload.single("image"), createAlert)
  .get(getAllAlerts);

router.post("/send-notification", verifyJwt, sendTestNotification);

router.route("/:alertId").delete(deleteAlert);

router.route("/:alertId").get(getAlertDetail);


// Interactions (Likes & Comments)
router.route("/:alertId/like").post(toggleLikeAlert);
router.route("/:alertId/dislike").post(toggleDislikeAlert);

router.route("/:alertId/comment").post(addComment);

export default router;