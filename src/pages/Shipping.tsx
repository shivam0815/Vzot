// src/pages/Shipping.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/Layout/SEO';

const Shipping: React.FC = () => {
  const LAST_UPDATED = '20 Aug 2025';

  const toc: Array<[string, string]> = [
    ['overview', 'Overview'],
    ['processing', 'Order Processing'],
    ['delivery', 'Delivery Timelines'],
    ['fees', 'Shipping Fees & COD'],
    ['tracking', 'Tracking & Status'],
    ['pincode', 'Serviceable Pincodes'],
    ['onDelivery', 'On-Delivery Issues'],
    ['returns', '7-Day Return Policy'],
    ['warranty', '1-Month Warranty (Applicable Products)'],
    ['refunds', 'Refunds & Replacement'],
    ['nonreturn', 'Non-Returnable Items'],
    ['packaging', 'Packaging & Handling'],
    ['intl', 'International Shipping'],
    ['contact', 'Support & Contact'],
    ['faq', 'Quick FAQ'],
  ];

  return (
    <div className="relative min-h-screen text-white">
      {/* VZOT layered background */}
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(1200px 700px at 20% 10%, rgba(0,255,180,0.18), transparent 60%),\
               radial-gradient(900px 600px at 85% 20%, rgba(3,180,140,0.18), transparent 60%),\
               radial-gradient(1000px 700px at 50% 100%, rgba(0,0,0,0.55), rgba(0,0,0,0.85))',
          }}
        />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              'conic-gradient(from 210deg at 70% 40%, rgba(18,170,120,0.20), rgba(0,0,0,0.2), rgba(0,140,110,0.25), rgba(0,0,0,0.25), rgba(18,170,120,0.20))',
          }}
        />
        <div className="absolute inset-0 mix-blend-overlay opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+qY8QxQAAAABJRU5ErkJggg==)' }} />
        <div className="absolute -top-20 -left-20 h-[420px] w-[420px] rounded-full blur-[90px] opacity-60" style={{ background: 'linear-gradient(140deg, #25F4B7, #0B7C67)' }} />
        <div className="absolute top-40 right-[-120px] h-[520px] w-[520px] rounded-full blur-[100px] opacity-50" style={{ background: 'linear-gradient(160deg, #0A1E28, #0D2E3A)' }} />
      </div>

      <SEO
        title="Shipping, Returns & Warranty — VZOT Technologies"
        description="VZOT Technologies shipping timelines, fees, tracking, 7-day returns, and 1-month warranty policy."
        canonicalPath="/shipping"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Shipping, Returns & Warranty — VZOT Technologies',
          url: 'https://vzot.in/shipping',
        }}
      />

      {/* Hero */}
      <section className="pt-16 pb-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-10 shadow-[0_15px_50px_rgba(0,0,0,0.25)]">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Shipping, Returns & Warranty
            </h1>
            <p className="mt-2 text-white/70">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="pb-16">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-[270px,1fr] gap-6 lg:gap-10">
          {/* TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <p className="text-sm font-semibold text-white/90 mb-3">On this page</p>
              <ul className="space-y-2 text-sm">
                {toc.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-white/70 hover:text-white">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Content */}
          <article className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 leading-relaxed">
            {/* Overview */}
            <section id="overview" className="mb-10">
              <h2 className="text-2xl font-semibold">Overview</h2>
              <p className="text-white/80 mt-2">
                VZOT Technologies ships across India via reputed courier partners. Returns are accepted within{' '}
                <strong>7 days</strong> of delivery for eligible items. Warranty on applicable products is{' '}
                <strong>1 month</strong> against manufacturing defects.
              </p>
            </section>

            {/* Processing */}
            <section id="processing" className="mb-10">
              <h2 className="text-2xl font-semibold">Order Processing</h2>
              <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
                <li>Dispatch window: usually <strong>24–48 hours</strong> on business days.</li>
                <li>Cut-off: orders after <strong>3:00 PM</strong> IST queue for next business day.</li>
                <li>High-volume sales or custom OEM branding may add handling time.</li>
                <li>Public holidays and Sundays are non-dispatch days.</li>
              </ul>
            </section>

            {/* Delivery */}
            <section id="delivery" className="mb-10">
              <h2 className="text-2xl font-semibold">Delivery Timelines</h2>
              <div className="overflow-x-auto not-prose mt-2">
                <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
                  <thead className="bg-white/10 text-white/80">
                    <tr>
                      <th className="p-3 text-left">Region</th>
                      <th className="p-3 text-left">Typical Transit</th>
                      <th className="p-3 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {[
                      ['Metro cities', '2–4 working days', 'Mumbai, Delhi-NCR, Bengaluru, Hyderabad, Chennai, Pune, Kolkata'],
                      ['Tier-2/3 cities', '3–6 working days', 'Subject to lane connectivity'],
                      ['Remote/ODA', '5–9 working days', 'Out-of-delivery-area pincodes may take longer'],
                    ].map(([a,b,c],i)=>(
                      <tr key={i} className="bg-white/5">
                        <td className="p-3">{a}</td>
                        <td className="p-3">{b}</td>
                        <td className="p-3">{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-white/60 mt-2 text-sm">Transit times are estimates. Weather, strikes, and carrier constraints can affect timelines.</p>
            </section>

            {/* Fees */}
            <section id="fees" className="mb-10">
              <h2 className="text-2xl font-semibold">Shipping Fees & COD</h2>
              <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
                <li>Prepaid shipping rates are shown at checkout based on cart weight and pincode.</li>
                <li>Cash-on-Delivery (COD) may include an additional convenience fee where enabled.</li>
                <li>Free-shipping promotions apply as per offer terms on the product or cart page.</li>
              </ul>
            </section>

            {/* Tracking */}
            <section id="tracking" className="mb-10">
              <h2 className="text-2xl font-semibold">Tracking & Status</h2>
              <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
                <li>Tracking link is shared by email/SMS after dispatch.</li>
                <li>You can also track in <Link to="/profile" className="underline hover:opacity-80">My Account &rarr; Orders</Link>.</li>
                <li>Delays beyond 72 hours of no scan updates: contact support with your order number.</li>
              </ul>
            </section>

            {/* Pincode */}
            <section id="pincode" className="mb-10">
              <h2 className="text-2xl font-semibold">Serviceable Pincodes</h2>
              <p className="text-white/80 mt-2">
                Most Indian pincodes are serviceable. If your pincode is non-serviceable or ODA, the checkout
                will indicate options or restrictions. For B2B bulk shipments, contact us for custom logistics.
              </p>
            </section>

            {/* On-Delivery Issues */}
            <section id="onDelivery" className="mb-10">
              <h2 className="text-2xl font-semibold">On-Delivery Issues</h2>
              <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
                <li><strong>Damaged parcel</strong>: refuse delivery or record an unboxing video and photos. Report within <strong>48 hours</strong>.</li>
                <li><strong>Shortage/incorrect item</strong>: share outer label photo and unboxing proof within <strong>48 hours</strong>.</li>
                <li>We will investigate with the courier and resolve per findings.</li>
              </ul>
            </section>

            {/* Returns */}
            <section id="returns" className="mb-10">
              <h2 className="text-2xl font-semibold">7-Day Return Policy</h2>
              <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
                <li>Return window: <strong>7 days</strong> from delivery date for eligible items.</li>
                <li>Condition: unused, complete accessories, original packaging and tags.</li>
                <li>Initiate: go to <Link to="/profile" className="underline hover:opacity-80">My Account &rarr; Orders</Link> and click <em>Request Return</em>, or contact support.</li>
                <li>Pickup or self-ship instructions will be shared after approval.</li>
                <li>Return rejection may occur for signs of use, missing parts, physical damage, or tampering.</li>
              </ul>
            </section>

            {/* Warranty */}
            <section id="warranty" className="mb-10">
              <h2 className="text-2xl font-semibold">1-Month Warranty (Applicable Products)</h2>
              <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
                <li>Warranty term: <strong>1 month</strong> from delivery on applicable products against manufacturing defects.</li>
                <li>Coverage: functional defects only. Cosmetic wear, accidental damage, liquid damage, and misuse excluded.</li>
                <li>Proof required: order number and issue photos/video. We may request inspection.</li>
                <li>Resolution: repair, replacement, or credit at VZOT’s discretion subject to stock and evaluation.</li>
              </ul>
              <p className="text-white/60 mt-2 text-sm">Product page mentions if warranty is applicable. OEM/bulk may have separate terms.</p>
            </section>

            {/* Refunds */}
            <section id="refunds" className="mb-10">
              <h2 className="text-2xl font-semibold">Refunds & Replacement</h2>
              <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
                <li>Refunds are processed to the original payment method within <strong>3–7 working days</strong> after QC pass.</li>
                <li>Replacement ships after the returned unit clears inspection and stock is available.</li>
                <li>Used consumables or missing accessories may lead to partial refunds.</li>
              </ul>
            </section>

            {/* Non-returnable */}
            <section id="nonreturn" className="mb-10">
              <h2 className="text-2xl font-semibold">Non-Returnable Items</h2>
              <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
                <li>Items marked non-returnable on the product page.</li>
                <li>Consumables and hygiene-sensitive items once opened.</li>
                <li>Physical damage, burnt ports, or signs of misuse.</li>
                <li>OEM/custom-printed goods unless defective on arrival.</li>
              </ul>
            </section>

            {/* Packaging */}
            <section id="packaging" className="mb-10">
              <h2 className="text-2xl font-semibold">Packaging & Handling</h2>
              <p className="text-white/80 mt-2">
                Products ship in protective packing. Keep all materials until you verify device fit and functionality.
                For returns, use the same or comparable protective packing.
              </p>
            </section>

            {/* International */}
            <section id="intl" className="mb-10">
              <h2 className="text-2xl font-semibold">International Shipping</h2>
              <p className="text-white/80 mt-2">
                International shipments are limited. Duties, taxes, and import rules are the buyer’s responsibility.
                Arrival times vary by lane and customs clearance.
              </p>
            </section>

            {/* Contact */}
            <section id="contact" className="mb-10">
              <h2 className="text-2xl font-semibold">Support & Contact</h2>
              <p className="text-white/80 mt-2">
                <strong>VZOT Technologies</strong><br />
                Email: <a href="mailto:support@nakodamobile.in" className="underline hover:opacity-80">support@nakodamobile.in</a>{' '}• WhatsApp: <a href="https://wa.me/+919650516703" target="_blank" rel="noreferrer" className="underline hover:opacity-80">+91 9650516703</a><br />
                Hours: Tue–Sun, 11:00–20:00 IST
              </p>
            </section>

            {/* Quick FAQ */}
            <section id="faq">
              <h2 className="text-2xl font-semibold">Quick FAQ</h2>
              <div className="mt-3 grid md:grid-cols-2 gap-3">
                {[
                  ['Can I change my address after ordering?', 'Before dispatch only. Contact support quickly with your order number.'],
                  ['Do you ship COD?', 'COD is available on select pincodes and cart values with a convenience fee.'],
                  ['When will I get my refund?', 'Typically within 3–7 working days after the return passes QC.'],
                  ['Is cable/charger covered by warranty?', 'If marked applicable on the product page, manufacturing defects are covered for 1 month.'],
                ].map(([q,a]) => (
                  <div key={q} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="font-medium">{q}</div>
                    <div className="text-white/80 text-sm mt-1">{a}</div>
                  </div>
                ))}
              </div>

              <p className="text-white/60 text-sm mt-6">
                By purchasing, you agree to these terms and our{' '}
                <Link to="/terms" className="underline hover:opacity-80">Terms &amp; Conditions</Link>{' '}and{' '}
                <Link to="/privacy" className="underline hover:opacity-80">Privacy Policy</Link>.
              </p>
            </section>
          </article>
        </div>
      </section>
    </div>
  );
};

export default Shipping;
