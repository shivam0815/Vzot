// src/pages/OrderSuccess.tsx
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckIcon } from '@heroicons/react/24/solid';
import VZOTBackground from '../components/Layout/VZOTBackground';
type SuccessState = {
  order?: any;
  orderId?: string | null;
  paymentMethod?: 'razorpay' | 'cod';
  paymentId?: string | null;
};

const coalesceId = (o: any) =>
  o?.orderNumber || o?._id || o?.id || o?.order_id || o?.paymentOrderId || o?.paymentId || undefined;

const OrderSuccess: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const incoming = (location.state as SuccessState | null) || null;
  const [orderId, setOrderId] = useState<string | undefined>(incoming?.orderId || undefined);

  useEffect(() => {
    const urlId = searchParams.get('id') || undefined;
    if (urlId && !orderId) setOrderId(urlId);

    if (!incoming) {
      try {
        const raw = localStorage.getItem('lastOrderSuccess');
        if (raw) {
          const parsed = JSON.parse(raw);
          const id = parsed?.orderId || coalesceId(parsed?.order) || coalesceId(parsed?.snapshot);
          if (id) setOrderId(String(id));
        }
      } catch {}
    } else {
      // keep for refresh
      localStorage.setItem('lastOrderSuccess', JSON.stringify(incoming));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goStatus = () => {
    // reflect on Profile → Orders; pass id if we have it
    const url = orderId
      ? `/profile?tab=orders&focus=${encodeURIComponent(orderId)}`
      : `/profile?tab=orders`;
    navigate(url, { replace: true });
  };

  const goShop = () => navigate('/products');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">

      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
            <VZOTBackground />
          <div className="mx-auto w-14 h-14 rounded-full border-4 border-blue-600 flex items-center justify-center mb-5">
            <CheckIcon className="w-7 h-7 text-blue-600" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Your Order is Confirmed!
          </h1>
          <p className="mt-2 text-gray-600">
            We&rsquo;ll send a shipping confirmation email as soon as your order ships.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={goStatus}
              className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none"
            >
              Check Status
            </button>
            <button
              onClick={goShop}
              className="px-6 py-3 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-100 hover:bg-blue-100 focus:outline-none"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
