import crypto from "crypto";
import axios from "axios";

const ENV = (process.env.PHONEPE_ENV || "sandbox").toLowerCase();
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID!;
const SALT_KEY = process.env.PHONEPE_SALT_KEY!;
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";

const BASE_URL =
  ENV === "production"
    ? process.env.PHONEPE_BASE_URL_PROD!
    : process.env.PHONEPE_BASE_URL_SANDBOX!;

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Generate headers for PhonePe APIs */
export function phonePeHeaders(body: object | "", apiPath: string) {
  const bodyBase64 =
    body === "" ? "" : Buffer.from(JSON.stringify(body)).toString("base64");
  const xVerify = `${sha256Hex(bodyBase64 + apiPath + SALT_KEY)}###${SALT_INDEX}`;
  return {
    "Content-Type": "application/json",
    "X-VERIFY": xVerify,
    "X-MERCHANT-ID": MERCHANT_ID,
  };
}

/** Create a transaction payload */
export async function createPhonePeTransaction(payload: {
  merchantTransactionId: string;
  amountInPaise: number;
  redirectUrl: string;
  callbackUrl: string;
  merchantUserId?: string;
}) {
  const apiPath = "/checkout/v2/pay";
  const body = {
    merchantId: MERCHANT_ID,
    merchantTransactionId: payload.merchantTransactionId,
    merchantUserId: payload.merchantUserId,
    amount: payload.amountInPaise,
    redirectUrl: payload.redirectUrl,
    callbackUrl: payload.callbackUrl,
    instrumentType: "PAY_PAGE",
  };

  const headers = phonePeHeaders(body, apiPath);
  const url = `${BASE_URL}${apiPath}`;

  const { data } = await axios.post(url, body, { headers, timeout: 10000 });
  return data;
}

export default { createPhonePeTransaction, phonePeHeaders };
