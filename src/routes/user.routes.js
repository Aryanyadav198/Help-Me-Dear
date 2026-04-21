import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  updateUserAccount,
  updateUserAvatar,
  changePassword,
  saveFcmToken
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", upload.single("avatar"), registerUser);
router.post("/login", loginUser);
router.post("/logout", verifyJwt, logoutUser);
router.get("/profile", verifyJwt, getUserProfile);
router.patch("/update-account", verifyJwt, updateUserAccount);
router.patch("/update-avatar", verifyJwt, upload.single("avatar"), updateUserAvatar);
router.post("/change-password", verifyJwt, changePassword);
router.post("/save-fcm",verifyJwt, saveFcmToken)

export default router;