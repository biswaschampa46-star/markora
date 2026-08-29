import "server-only";

/**
 * Payment gateway abstraction for the delivery-charge pre-payment.
 *
 * SECURITY CONTRACT
 * -----------------
 * The client only ever submits a transaction ID (TxnID). A payment is NEVER
 * accepted because the frontend claims "success" — verification happens in
 * exactly one of two ways:
 *
 *   1. Automatic: when official gateway credentials are configured below, the
 *      TxnID is verified against the bKash/Nagad API before it can be marked
 *      verified.
 *   2. Manual: an authorized admin cross-checks the TxnID in the bKash/Nagad
 *      merchant app and explicitly verifies the payment record.
 *
 * To plug in the official bKash Tokenized Checkout API, set the BKASH_* env
 * vars in .env.local. For Nagad merchant API, set the NAGAD_* env vars and
 * complete the `verifyWithNagad` stub (the official Nagad API requires a
 * signed server-to-server callback; see the TODO below).
 */

export type PaymentGatewayMethod = "bkash" | "nagad" | "rocket";

export type GatewayVerification = {
  /** Whether an automatic gateway integration is configured for the method. */
  available: boolean;
  /** When available: whether the gateway confirmed the transaction. */
  verified: boolean;
  message: string;
};

// ---------------------------------------------------------------------------
// bKash (Tokenized Checkout — transaction query endpoints)
// ---------------------------------------------------------------------------

const BKASH_BASE_URL = process.env.BKASH_BASE_URL; // e.g. https://tokenized.sandbox.bka.sh/v1.2.0-beta
const BKASH_APP_KEY = process.env.BKASH_APP_KEY;
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET;
const BKASH_USERNAME = process.env.BKASH_USERNAME;
const BKASH_PASSWORD = process.env.BKASH_PASSWORD;

export function isBkashConfigured(): boolean {
  return Boolean(BKASH_BASE_URL && BKASH_APP_KEY && BKASH_APP_SECRET && BKASH_USERNAME && BKASH_PASSWORD);
}

/** Exchanges credentials for a short-lived bKash bearer token. */
async function getBkashIdToken(): Promise<string> {
  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: BKASH_USERNAME as string,
      password: BKASH_PASSWORD as string,
    },
    body: JSON.stringify({
      app_key: BKASH_APP_KEY,
      app_secret: BKASH_APP_SECRET,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`bKash token grant failed (${res.status})`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("bKash token grant returned no id_token");
  return data.id_token;
}

async function verifyWithBkash(transactionId: string, expectedAmount: number): Promise<GatewayVerification> {
  const idToken = await getBkashIdToken();
  const res = await fetch(`${BKASH_BASE_URL}/tokenized/checkout/general/searchTransaction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: idToken,
      "X-App-Key": BKASH_APP_KEY as string,
    },
    body: JSON.stringify({ trxID: transactionId }),
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      available: true,
      verified: false,
      message: `bKash API verification failed (HTTP ${res.status}). Verify manually.`,
    };
  }
  const data = (await res.json()) as {
    trxID?: string;
    transactionStatus?: string;
    amount?: string;
  };

  const statusOk = data.transactionStatus === "Completed";
  const amountOk = data.amount !== undefined && Number(data.amount) >= expectedAmount;
  if (statusOk && amountOk) {
    return { available: true, verified: true, message: "bKash gateway confirmed the transaction." };
  }
  return {
    available: true,
    verified: false,
    message: !statusOk
      ? `bKash transaction status: ${data.transactionStatus ?? "unknown"}.`
      : "bKash transaction amount is lower than the expected delivery charge.",
  };
}

// ---------------------------------------------------------------------------
// Nagad (merchant API) — integration point
// ---------------------------------------------------------------------------

// TODO: When Nagad merchant credentials become available, implement the
// server-to-server transaction verification here using:
//   NAGAD_BASE_URL, NAGAD_MERCHANT_ID, NAGAD_PRIVATE_KEY, NAGAD_PUBLIC_KEY
// Until then Nagad falls back to manual admin verification, which is safe:
// no payment can become "verified" without an explicit admin action.
async function verifyWithNagad(_transactionId: string, _expectedAmount: number): Promise<GatewayVerification> {
  return {
    available: false,
    verified: false,
    message: "Nagad auto-verification is not configured — manual verification required.",
  };
}

/** Whether automatic gateway verification is configured for a method. */
export function isGatewayConfigured(method: PaymentGatewayMethod): boolean {
  if (method === "bkash") return isBkashConfigured();
  return false; // nagad / rocket: manual verification until APIs are wired up
}

/**
 * Verifies a transaction with the official gateway when configured. When no
 * gateway integration exists for the method the result is
 * `{ available: false }` and the caller MUST fall back to explicit manual
 * admin verification — it must never treat the payment as verified.
 */
export async function verifyTransactionWithGateway(
  method: PaymentGatewayMethod,
  transactionId: string,
  expectedAmount: number,
): Promise<GatewayVerification> {
  try {
    if (!transactionId) {
      return { available: false, verified: false, message: "Missing transaction ID." };
    }
    switch (method) {
      case "bkash":
        if (!isBkashConfigured()) {
          return { available: false, verified: false, message: "bKash auto-verification is not configured." };
        }
        return await verifyWithBkash(transactionId, expectedAmount);
      case "nagad":
        return await verifyWithNagad(transactionId, expectedAmount);
      default:
        return { available: false, verified: false, message: "No auto-verification for this method." };
    }
  } catch (error) {
    // Gateway outages must never block manual verification nor auto-approve.
    console.error(`[payments] gateway verification failed (${method}):`, error);
    return {
      available: true,
      verified: false,
      message: "Gateway API error. Verify manually.",
    };
  }
}
