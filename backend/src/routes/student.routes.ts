import { Router } from "express";
import multer from "multer";
import { StudentController, enrolStudentSchema, transferStudentSchema } from "../controllers/student.controller";
import { validateRequest } from "../middlewares/validation";
import { authenticateToken, requireRole } from "../middlewares/auth";

const router = Router();
const controller = new StudentController();

// Configure Multer for in-memory image buffers
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file limit
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
      return cb(new Error("Please upload an image file (jpg, jpeg, png, or webp)"));
    }
    cb(null, true);
  },
});

// Applied globally to student routes
router.use(authenticateToken as any);

router.post(
  "/",
  requireRole("headteacher"),
  validateRequest({ body: enrolStudentSchema }),
  (req, res) => controller.enrol(req as any, res)
);

router.get(
  "/",
  requireRole("headteacher", "class_teacher", "bursar"),
  (req, res) => controller.list(req as any, res)
);

router.get(
  "/:id",
  requireRole("headteacher", "class_teacher", "bursar", "parent", "student"),
  (req, res) => controller.getProfile(req as any, res)
);

router.put(
  "/:id",
  requireRole("headteacher", "class_teacher"),
  (req, res) => controller.update(req as any, res)
);

router.post(
  "/:id/photo",
  requireRole("headteacher", "class_teacher"),
  upload.single("photo"),
  (req, res) => controller.uploadPhoto(req as any, res)
);

router.put(
  "/:id/transfer",
  requireRole("headteacher"),
  validateRequest({ body: transferStudentSchema }),
  (req, res) => controller.transfer(req as any, res)
);

export default router;
