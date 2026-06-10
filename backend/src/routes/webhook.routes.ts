import { Router } from "express";
import { WebhookController } from "../controllers/webhook.controller";

const router = Router();
const controller = new WebhookController();

router.post("/hubtel", (req, res) => controller.hubtelCallback(req, res));

export default router;
