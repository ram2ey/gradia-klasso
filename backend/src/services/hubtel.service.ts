export class HubtelService {
  private clientId = process.env.HUBTEL_CLIENT_ID;
  private clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  private merchantAccount = process.env.HUBTEL_MERCHANT_ACCOUNT;

  private isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.merchantAccount);
  }

  /**
   * Initiates a Mobile Money Receive request.
   */
  async receiveMobileMoney(input: {
    amount: number;
    phone: string;
    network: "mtn" | "telecel" | "airteltigo";
    clientReference: string;
    customerName: string;
    customerEmail?: string;
    callbackUrl: string;
  }) {
    if (!this.isConfigured()) {
      console.warn("[HubtelService]: Running in MOCK MODE. Hubtel credentials not configured.");
      return {
        success: true,
        transactionId: `mock-ref-${Date.now()}`,
        status: "pending",
        checkoutUrl: null,
      };
    }

    let channel = "mtn-gh";
    if (input.network === "telecel") channel = "vodafone-gh";
    else if (input.network === "airteltigo") channel = "tigo-gh";

    const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`;
    const url = `https://api.hubtel.com/v1/merchantaccount/merchants/${this.merchantAccount}/receive/mobilemoney`;

    const body = {
      CustomerName: input.customerName,
      CustomerMsisdn: input.phone,
      CustomerEmail: input.customerEmail || "schoolfees@gradia.edu",
      Channel: channel,
      Amount: input.amount,
      PrimaryCallbackURL: input.callbackUrl,
      Description: `Gradia Klasso School Fees Payment - Ref: ${input.clientReference}`,
      ClientReference: input.clientReference,
      FeesOnCustomer: false,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data: any = await response.json();
      
      if (response.ok && (data.ResponseCode === "00" || data.ResponseCode === "01")) {
        return {
          success: true,
          transactionId: data.TransactionId || data.Data?.TransactionId,
          status: "pending",
          checkoutUrl: data.Data?.CheckoutUrl || null,
        };
      } else {
        console.error("[HubtelService]: Receive MoMo failed:", data);
        throw new Error(data.Message || "Hubtel transaction initiation failed");
      }
    } catch (err: any) {
      console.error("[HubtelService]: HTTP request failure:", err);
      throw new Error(err.message || "Failed to contact Hubtel payment gateway");
    }
  }

  /**
   * Polls the transaction status from Hubtel API.
   */
  async getTransactionStatus(clientReference: string) {
    if (!this.isConfigured()) {
      console.log(`[HubtelService MOCK]: Polling status for ${clientReference} -> success`);
      return {
        status: "success",
        transactionId: `mock-tx-${Date.now()}`,
      };
    }

    const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`;
    const url = `https://api.hubtel.com/v1/merchantaccount/merchants/${this.merchantAccount}/transactions/status?clientReference=${clientReference}`;

    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
        },
      });

      if (response.ok) {
        const data: any = await response.json();
        const tx = data.Data?.[0] || data.Data;
        if (tx) {
          const status = tx.Status?.toLowerCase();
          return {
            status: status === "success" || status === "approved" ? "success" : status === "failed" ? "failed" : "pending",
            transactionId: tx.TransactionId,
          };
        }
      }
      return { status: "pending", transactionId: null };
    } catch (err) {
      console.error("[HubtelService]: Status poll error:", err);
      return { status: "pending", transactionId: null };
    }
  }
}
