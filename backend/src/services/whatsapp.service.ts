/**
 * WhatsApp Business Cloud API Integration Service.
 * Sends text messages via Meta's Graph API.
 * Falls back to mock/console logging when WHATSAPP_API_TOKEN is not configured.
 */
export class WhatsAppService {
  private apiToken = process.env.WHATSAPP_API_TOKEN;
  private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  private isConfigured(): boolean {
    return !!(this.apiToken && this.phoneNumberId);
  }

  /**
   * Sends a plain text WhatsApp message to the specified phone number.
   * Phone should include country code (e.g. +233244123456).
   */
  async sendMessage(to: string, message: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn("[WhatsAppService]: Running in MOCK MODE. WHATSAPP_API_TOKEN not configured.");
      console.log(`[WhatsApp MOCK] To: ${to}\nMessage:\n${message}`);
      return true;
    }

    try {
      let formattedPhone = to.trim();
      if (formattedPhone.startsWith("0")) {
        formattedPhone = `233${formattedPhone.substring(1)}`;
      } else if (formattedPhone.startsWith("+")) {
        formattedPhone = formattedPhone.substring(1);
      }

      const url = `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`;

      const body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data: any = await response.json();
        console.log(
          `[WhatsAppService]: Message sent successfully to ${formattedPhone}.`,
          data?.messages?.[0]?.id
        );
        return true;
      } else {
        const errData = await response.text();
        console.error("[WhatsAppService]: Meta API error response:", errData);
        return false;
      }
    } catch (error) {
      console.error("[WhatsAppService]: Failed to send WhatsApp message:", error);
      return false;
    }
  }
}
