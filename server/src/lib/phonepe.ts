import axios from 'axios';
import crypto from 'crypto';

export const BASE_URL =
  process.env.PHONEPE_ENV === 'production'
    ? process.env.PHONEPE_BASE_URL_PROD!
    : process.env.PHONEPE_BASE_URL_SANDBOX!;

export function xHeaders(bodyB64: string, path: string) {
  const salt = process.env.PHONEPE_SALT_KEY!;
  const index = process.env.PHONEPE_SALT_INDEX || '1';
  const checksum =
    crypto.createHash('sha256').update(bodyB64 + path + salt).digest('hex') + '###' + index;
  return {
    'Content-Type': 'application/json',
    'X-VERIFY': checksum,
    'X-MERCHANT-ID': process.env.PHONEPE_MERCHANT_ID!,
  };
}

export async function createPhonePeTransaction(opts: {
  merchantTransactionId: string;
  amountInPaise: number;
  redirectUrl: string;
  callbackUrl: string;
  merchantUserId?: string;
}) {
  const path = '/pg/v1/pay';
  const payload = {
    merchantId: process.env.PHONEPE_MERCHANT_ID!,
    merchantTransactionId: opts.merchantTransactionId,
    merchantUserId: opts.merchantUserId,
    amount: opts.amountInPaise,
    redirectUrl: opts.redirectUrl,
    callbackUrl: opts.callbackUrl,
    paymentInstrument: { type: 'PAY_PAGE' },
  };
  const bodyB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const headers = xHeaders(bodyB64, path);
  return axios.post(`${BASE_URL}${path}`, { request: bodyB64 }, { headers, timeout: 10000 });
}
