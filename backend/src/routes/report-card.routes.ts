import { Router } from "express";
import multer from "multer";
import { ReportCardController } from "../controllers/report-card.controller";
import { authenticateToken, requireRole } from "../middlewares/auth";

const router = Router();
const controller = new ReportCardController();

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
      return cb(new Error("Please upload an image file (jpg, jpeg, png, or webp)"));
    }
    cb(null, true);
  },
});

router.use(authenticateToken as any);

router.get(
  "/school/settings",
  requireRole("headteacher", "class_teacher"),
  (req, res) => controller.getSchoolSettings(req as any, res)
);

router.post(
  "/school/upload",
  requireRole("headteacher"),
  upload.single("file"),
  (req, res) => controller.uploadSchoolAsset(req as any, res)
);

router.post(
  "/generate",
  requireRole("headteacher"),
  (req, res) => controller.generate(req as any, res)
);

router.get(
  "/class/:classId",
  requireRole("headteacher", "class_teacher"),
  (req, res) => controller.getClassReportCards(req as any, res)
);

router.get(
  "/:studentId",
  requireRole("headteacher", "class_teacher", "parent", "student"),
  (req, res) => controller.getStudentReportCard(req as any, res)
);

router.put(
  "/remarks",
  requireRole("headteacher", "class_teacher"),
  (req, res) => controller.updateRemarks(req as any, res)
);

export default router;
