// src/components/FAQs.tsx
import React, { useState } from 'react';
import { QuestionMarkCircleIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';

const data = [
  { q: 'How long does delivery take?', a: 'Standard delivery takes 2–7 working days depending on your pincode.' },
  { q: 'What is the return policy?', a: 'You can return eligible items within 7 days of delivery if unused and in original packaging.' },
  { q: 'Which payment methods are accepted?', a: 'We accept UPI, major cards, net-banking, and popular wallets via Razorpay.' },
  { q: 'How do I claim warranty?', a: 'Contact support with your order number and issue details; we’ll guide you through the claim.' },
];

const FAQs: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="max-w-3xl text-white">
      <div className="flex items-center gap-2 mb-5">
        <QuestionMarkCircleIcon className="w-5 h-5 text-white" />
        <h3 className="text-lg font-semibold">Frequently Asked Questions</h3>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden divide-y divide-white/10">
        {data.map((item, i) => {
          const active = open === i;
          const panelId = `faq-panel-${i}`;
          const btnId = `faq-btn-${i}`;

          return (
            <div key={item.q}>
              <button
                id={btnId}
                aria-controls={panelId}
                aria-expanded={active}
                onClick={() => setOpen(active ? null : i)}
                className={clsx(
                  'w-full text-left px-4 md:px-5 py-4 md:py-5 transition',
                  'hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">{item.q}</div>
                    {active && (
                      <div className="mt-1 text-sm text-white/80">{item.a}</div>
                    )}
                  </div>
                  <ChevronDownIcon
                    className={clsx(
                      'w-5 h-5 text-white/70 transition-transform',
                      active && 'rotate-180'
                    )}
                  />
                </div>
              </button>

              {/* Optional animated panel height (kept simple for reliability) */}
              {/* If you prefer always-in-DOM with height transition, replace conditional render with a max-h animation. */}
              {!active ? null : (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className="px-4 md:px-5 pb-4 md:pb-5 text-sm text-white/80"
                >
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FAQs;
