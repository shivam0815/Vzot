// src/lib/phonepe.ts
import axios from 'axios';
import crypto from 'crypto';

const ENV = (process.env.PHONEPE_ENV || 'sandbox').toLowerCase();
const BASE = ENV === 'production'
  ? process.env.PHONEPE_BASE_URL_PROD!
  : process.env.PHONEPE_BASE_URL_SANDBOX!;
const MID = process.env.PHONEPE_MERCHANT_ID!;
const SALT = process.env.PHONEPE_SALT_KEY!;
const IDX  = process.env.PHONEPE_SALT_INDEX || '1';

const sha256 = (s:string) => crypto.createHash('sha256').update(s).digest('hex');

function xVerify(bodyB64: string, path: string) {
  return `${sha256(bodyB64 + path + SALT)}###${IDX}`;
}

export async function phonepePay(payload: {
  merchantTxnId: string;
  amountPaise: number;
  redirectUrl: string;
  callbackUrl: string;
  merchantUserId?: string;
}) {
  const path = '/pg/v1/pay';
  const raw = {
    merchantId: MID,
    merchantTransactionId: payload.merchantTxnId,
    merchantUserId: payload.merchantUserId,
    amount: payload.amountPaise,
    redirectUrl: payload.redirectUrl,
    callbackUrl: payload.callbackUrl,
    instrumentType: 'PAY_PAGE',
  };
  const bodyB64 = Buffer.from(JSON.stringify(raw)).toString('base64');
  const headers = {
    'Content-Type': 'application/json',
    'X-VERIFY': xVerify(bodyB64, path),
    'X-MERCHANT-ID': MID,
  };
  const { data } = await axios.post(`${BASE}${path}`, { request: bodyB64 }, { headers, timeout: 10000 });
  return data; // data.data.instrumentResponse.redirectInfo.url
}

export async function phonepeStatus(merchantTxnId: string) {
  const path = `/pg/v1/status/${MID}/${merchantTxnId}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-VERIFY': xVerify('', path), // empty body for status
    'X-MERCHANT-ID': MID,
  };
  const { data } = await axios.get(`${BASE}${path}`, { headers, timeout: 8000 });
  return data; // data.code === 'PAYMENT_SUCCESS' (or data.data.state === 'COMPLETED')
}
