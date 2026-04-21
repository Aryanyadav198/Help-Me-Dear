// import multer from "multer";

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, "./public/temp"),
//   filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname),
// });

// export const upload = multer({ storage });
import multer from "multer";
import fs from "fs";
import path from "path";

// 🔥 Create absolute path
const uploadPath = path.join(process.cwd(), "public", "temp");

// 🔥 Ensure folder exists (VERY IMPORTANT)
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "_" + file.originalname),
});

export const upload = multer({ storage });