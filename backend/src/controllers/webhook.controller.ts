import { Request, Response } from "express";
import crypto from "crypto";
import { FeeService } from "../services/fee.service";

const feeService = new FeeService();

export class WebhookController {
  async hubtelCallback(req: Request, res: Response) {
    try {
      const signature = req.headers["x-hubtel-signature"] as string;
      const secret = process.env.HUBTEL_CLIENT_SECRET || process.env.HUBTEL_WEBHOOK_SECRET;

      if (secret) {
        if (!signature) {
          console.error("[WebhookController] Missing X-Hubtel-Signature header");
          return res.status(401).json({ success: false, error: "Missing signature" });
        }

        const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
        
        // Check hex signature
        const expectedSignatureHex = crypto
          .createHmac("sha256", secret)
          .update(rawBody)
          .digest("hex");

        // Check base64 signature
        const expectedSignatureBase64 = crypto
          .createHmac("sha256", secret)
          .update(rawBody)
          .digest("base64");

        const sigBuf = Buffer.from(signature, "utf-8");
        const hexBuf = Buffer.from(expectedSignatureHex, "utf-8");
        const base64Buf = Buffer.from(expectedSignatureBase64, "utf-8");

        const isHexMatch = sigBuf.length === hexBuf.length && crypto.timingSafeEqual(sigBuf, hexBuf);
        const isBase64Match = sigBuf.length === base64Buf.length && crypto.timingSafeEqual(sigBuf, base64Buf);

        if (!isHexMatch && !isBase64Match) {
          console.error("[WebhookController] Invalid signature verification failed");
          return res.status(401).json({ success: false, error: "Invalid signature" });
        }
      } else {
        console.warn(
          "[WebhookController] HUBTEL_CLIENT_SECRET or HUBTEL_WEBHOOK_SECRET not configured. Bypassing signature verification for testing."
        );
      }

      const payload = req.body;
      const clientReference = payload.Data?.ClientReference || payload.ClientReference;
      const transactionId =
        payload.Data?.TransactionId ||
        payload.TransactionId ||
        payload.Data?.TransactionReference ||
        payload.TransactionReference;
      const rawStatus = (payload.Data?.Status || payload.Status || "").toLowerCase();
      const responseCode = payload.ResponseCode || payload.Data?.ResponseCode;

      if (!clientReference) {
        return res.status(400).json({ success: false, error: "Missing ClientReference" });
      }

      let status: "success" | "failed" = "failed";
      if (
        rawStatus === "success" ||
        rawStatus === "approved" ||
        responseCode === "00" ||
        responseCode === "0000"
      ) {
        status = "success";
      } else if (rawStatus === "failed" || rawStatus === "declined" || rawStatus === "error") {
        status = "failed";
      } else {
        console.log(`[WebhookController] Unhandled payment state: ${rawStatus || responseCode}. Leaving pending.`);
        return res.status(200).json({ success: true, message: "Transaction in progress" });
      }

      console.log(`[WebhookController] Resolving payment ref: ${clientReference} with status: ${status}, txId: ${transactionId}`);
      await feeService.handleHubtelWebhook(clientReference, transactionId || "", status);

      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("[WebhookController] Error processing webhook:", err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
}
