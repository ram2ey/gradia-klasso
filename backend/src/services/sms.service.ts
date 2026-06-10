export class SmsService {
  private apiKey = process.env.AFRICAS_TALKING_API_KEY;
  private username = process.env.AFRICAS_TALKING_USERNAME || "sandbox";

  /**
   * Dispatches a transactional SMS to a parent's phone.
   * Replaces local '0' prefixes with international '+233' parameters.
   */
  async sendSms(to: string, message: string): Promise<boolean> {
    if (!this.apiKey) {
      console.warn("[SmsService]: SMS not sent: AFRICAS_TALKING_API_KEY is not configured.");
      console.log(`[SMS MOCK] To: ${to}\nMessage:\n${message}`);
      return true; // Simulate success in dev environment
    }

    try {
      let formattedPhone = to.trim();
      if (!formattedPhone.startsWith("+")) {
        if (formattedPhone.startsWith("0")) {
          formattedPhone = `+233${formattedPhone.substring(1)}`;
        } else {
          formattedPhone = `+${formattedPhone}`;
        }
      }

      const params = new URLSearchParams();
      params.append("username", this.username);
      params.append("to", formattedPhone);
      params.append("message", message);

      const response = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          "apiKey": this.apiKey,
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (response.ok) {
        const data: any = await response.json();
        console.log(`[SmsService]: SMS sent successfully to ${formattedPhone}.`, data?.SMSMessageData?.Recipients?.[0]?.messageId);
        return true;
      } else {
        const errText = await response.text();
        console.error("[SmsService]: Africa's Talking API error response:", errText);
        return false;
      }
    } catch (error) {
      console.error("[SmsService]: Failed to send SMS:", error);
      return false;
    }
  }
}
