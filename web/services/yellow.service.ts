const SERVICE_URL = process.env.NEXT_PUBLIC_SERVICE_URL || "http://localhost:4000";

export interface YellowPaymentRequirements {
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    payTo: string;
    asset: string;
    extra?: {
      clearnetUrl?: string;
      appName?: string;
    };
  }>;
}

export interface YellowPaymentPayload {
  scheme: string;
  payload: {
    transactionId: number;
    fromAccount?: string;
    toAccount?: string;
    asset?: string;
    amount?: string;
  };
}

export class YellowService {
  /**
   * Step 1: Get payment requirements from an endpoint (returns 402)
   */
  static async getPaymentRequirements(
    endpoint: string
  ): Promise<YellowPaymentRequirements> {
    const url = `${SERVICE_URL}${endpoint}`;
    const response = await fetch(url, { method: "GET" });

    // 402 is the expected response for X402 endpoints (Payment Required)
    if (!response.ok && response.status !== 402) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || `Failed to get requirements: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Step 2: Call endpoint with payment proof
   */
  static async callEndpointWithPayment(
    endpoint: string,
    paymentPayload: YellowPaymentPayload
  ): Promise<any> {
    const url = `${SERVICE_URL}${endpoint}`;
    const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-PAYMENT": xPaymentHeader,
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(
        responseData.error || `Request failed with status ${response.status}`
      );
    }

    return responseData;
  }
}
