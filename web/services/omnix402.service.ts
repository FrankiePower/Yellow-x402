const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3021";

export interface PaymentRequirements {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    extra: {
      name: string;
      version: string;
    };
    destNetwork?: string;
  }>;
  error?: string;
}

export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
  };
}

export class Omnix402Service {
  /**
   * Step 1: Get payment requirements from an X402 endpoint
   */
  static async getPaymentRequirements(
    endpointUrl: string,
    network: "base" | "polygon"
  ): Promise<PaymentRequirements> {
    const response = await fetch(
      `${API_URL}/api?endpoint=${encodeURIComponent(
        endpointUrl
      )}&network=${network}`,
      { method: "GET" }
    );

    // 402 is the expected response for X402 endpoints (Payment Required)
    if (!response.ok && response.status !== 402) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to get requirements");
    }

    return response.json();
  }

  /**
   * Step 2: Create payment payload with signature
   */
  static createPaymentPayload(
    requirements: PaymentRequirements,
    network: "base" | "polygon",
    address: string,
    signature: string,
    validAfter: number,
    validBefore: number,
    nonce: string
  ): PaymentPayload {
    const accept = requirements.accepts.find((a) => a.network === network);
    if (!accept) {
      throw new Error("No accept found for current network");
    }

    return {
      x402Version: 1,
      scheme: "exact",
      network: network,
      payload: {
        signature: signature,
        authorization: {
          from: address,
          to: accept.payTo,
          value: accept.maxAmountRequired,
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce: nonce,
        },
      },
    };
  }

  /**
   * Step 3: Call endpoint with payment
   */
  static async callEndpointWithPayment(
    paymentPayload: PaymentPayload,
    requestBody: any
  ): Promise<any> {
    const response = await fetch(`${API_URL}/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": btoa(JSON.stringify(paymentPayload)),
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(
        responseData.error || `Request failed with status ${response.status}`
      );
    }

    return responseData;
  }

  /**
   * Request a demo transaction (backend simulated)
   */
  static async requestDemo(): Promise<{
    callId: string;
  }> {
    const response = await fetch(`${API_URL}/demo`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(
        responseData.error ||
          `Demo request failed with status ${response.status}`
      );
    }

    return responseData;
  }

  /**
   * Get call status by ID
   */
  static async getCallStatus(callId: string): Promise<{
    sourceChainName: string;
    destinationChainName: string;
    sourcePaymentStatus?: string;
    sourcePaymentTxHash?: string;
    verifyStatus?: string;
    verifyHash?: string;
    relayStatus?: string;
    relayHash?: string;
    executionStatus?: string;
    executionHash?: string;
    destPaymentHash?: string;
    xPaymentResponse?: any;
    createdAt?: string;
    updatedAt?: string;
  }> {
    const response = await fetch(`${API_URL}/demo/call?callId=${callId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(
        responseData.error ||
          `Failed to get call status with status ${response.status}`
      );
    }

    return responseData;
  }

  /**
   * Generate a random nonce for EIP-3009
   */
  static generateNonce(): string {
    return `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  /**
   * Get network name from chain ID
   */
  static getNetworkFromChainId(
    chainId: number | undefined
  ): "base" | "polygon" | null {
    if (chainId === 8453) return "base";
    if (chainId === 137) return "polygon";
    return null;
  }
}
