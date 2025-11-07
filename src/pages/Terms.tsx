// src/pages/Terms.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/Layout/SEO';

const Terms: React.FC = () => {
  const LAST_UPDATED = '20 Aug 2025';

  const sections: Array<[string, string]> = [
    ['intro','Introduction'],
    ['accounts','Eligibility & Accounts'],
    ['product','Product Info & Images'],
    ['pricing','Pricing, Errors & Promotions'],
    ['orders','Orders, Acceptance & Cancellation'],
    ['payments','Payments, EMI & Fraud Checks'],
    ['shipping','Shipping, Delivery & Customs'],
    ['returns','Returns, Refunds & Warranty'],
    ['oem','OEM / Bulk Terms'],
    ['ugc','User Reviews & Content'],
    ['conduct','Acceptable Use & Prohibited Activities'],
    ['force','Force Majeure'],
    ['liability','Warranty & Liability'],
    ['indemnity','Indemnification'],
    ['termination','Termination'],
    ['law','Governing Law & Disputes'],
    ['changes','Changes to Terms'],
    ['contact','Contact Us'],
  ];

  return (
    <div className="relative min-h-screen text-white">
      {/* VZOT green/black layered background */}
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
            filter: 'saturate(1.1)',
          }}
        />
        <div className="absolute inset-0 mix-blend-overlay opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4//8/AwAI/AL+qY8QxQAAAABJRU5ErkJggg==)' }} />
        <div className="absolute -top-20 -left-20 h-[420px] w-[420px] rounded-full blur-[90px] opacity-60" style={{ background: 'linear-gradient(140deg, #25F4B7, #0B7C67)' }} />
        <div className="absolute top-40 right-[-120px] h-[520px] w-[520px] rounded-full blur-[100px] opacity-50" style={{ background: 'linear-gradient(160deg, #0A1E28, #0D2E3A)' }} />
      </div>

      <SEO
        title="Terms & Conditions — VZOT Technologies"
        description="Terms for using VZOT Technologies’ website, products, OEM services, and promotions."
        canonicalPath="/terms"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Terms & Conditions — VZOT Technologies',
          url: 'https://vzot.in/terms'
        }}
      />

      {/* Hero */}
      <section className="pt-16 pb-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-10 shadow-[0_15px_50px_rgba(0,0,0,0.25)]">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Terms &amp; Conditions</h1>
            <p className="mt-2 text-white/70">Last updated: {LAST_UPDATED}</p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="pb-16">
        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-[270px,1fr] gap-6 lg:gap-10">
          {/* In-page nav */}
          <aside className="hidden lg:block">
            <div className="sticky top-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <p className="text-sm font-semibold text-white/90 mb-3">On this page</p>
              <ul className="space-y-2 text-sm">
                {sections.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-white/70 hover:text-white">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Article */}
          <article className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 leading-relaxed">
            <h2 id="intro" className="text-2xl font-semibold">Introduction</h2>
            <p className="text-white/80 mt-2">
              Welcome to <strong>VZOT Technologies</strong> (“VZOT”, “we”, “our”, “us”). These Terms govern your use of our
              website, products, services, and OEM/bulk offerings. By using our site, you agree to these Terms and our{' '}
              <Link to="/privacy" className="underline hover:opacity-80">Privacy Policy</Link>.
            </p>

            <h2 id="accounts" className="mt-10 text-2xl font-semibold">Eligibility & Accounts</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>You must be capable of entering into a binding agreement under applicable law.</li>
              <li>You are responsible for your account and keeping credentials secure.</li>
              <li>Provide accurate and complete information and notify us of changes.</li>
            </ul>

            <h2 id="product" className="mt-10 text-2xl font-semibold">Product Info & Images</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>Specs, images, and colors may vary due to lighting or screen differences.</li>
              <li>Compatibility info is provided in good faith. Verify with your exact device model.</li>
              <li>We may update features or packaging without notice to improve quality.</li>
            </ul>

            <h2 id="pricing" className="mt-10 text-2xl font-semibold">Pricing, Errors & Promotions</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>All prices are in INR unless stated otherwise and may change without notice.</li>
              <li>We may correct pricing or typographical errors. If discovered after you order, we’ll ask you to confirm or cancel.</li>
              <li>Coupons, promo codes, gift cards, and referral credits have specific terms and may be time, usage, or category limited.</li>
              <li>Pre-order or back-order timelines are estimates, not guarantees.</li>
            </ul>

            <h2 id="orders" className="mt-10 text-2xl font-semibold">Orders, Acceptance & Cancellation</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>Your order is an offer to purchase. Acceptance occurs when we dispatch the items.</li>
              <li>We may cancel or refuse orders due to stock limits, suspected fraud, pricing errors, or regulatory reasons.</li>
              <li>You can request cancellation before dispatch. After dispatch, standard return rules apply.</li>
            </ul>

            <h2 id="payments" className="mt-10 text-2xl font-semibold">Payments, EMI & Fraud Checks</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>Payments are processed by trusted gateways. We do not store full card details.</li>
              <li>We may run automated or manual fraud checks and request additional verification.</li>
              <li>EMI, if available, is subject to bank or provider terms. Interest or processing fees may apply.</li>
            </ul>

            <h2 id="shipping" className="mt-10 text-2xl font-semibold">Shipping, Delivery & Customs</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>We ship via reputed carriers. Delivery estimates are indicative.</li>
              <li>Risk of loss passes on delivery to your address or pick-up point.</li>
              <li>For international orders, you are responsible for customs duties, taxes, and import compliance.</li>
            </ul>

            <h2 id="returns" className="mt-10 text-2xl font-semibold">Returns, Refunds & Warranty</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>Standard return window is <strong>7 days</strong> from delivery for eligible items, unused and in original packaging. Category-specific exceptions may apply.</li>
              <li>Warranty varies by manufacturer or product; proof of purchase may be required.</li>
              <li>Refunds are typically issued to the original payment method after inspection.</li>
            </ul>

            <h2 id="oem" className="mt-10 text-2xl font-semibold">OEM / Bulk Terms</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li><strong>MOQ</strong>: Minimum order quantities apply per product.</li>
              <li><strong>Branding</strong>: You warrant you own or license the IP provided for printing/packaging.</li>
              <li><strong>Proofing</strong>: Production begins after written approval of samples, artwork, or colour proofs.</li>
              <li><strong>Lead times</strong>: As communicated in the quote; timelines are estimates and depend on volume/materials.</li>
              <li><strong>Tolerances</strong>: Industry-standard variance in colour, finish, or quantity may occur.</              li>
              <li><strong>Shipping terms</strong>: Incoterms (e.g., FOB/CIF/DDP) per the quotation.</li>
              <li><strong>Non-cancellable after production start</strong> unless agreed in writing.</li>
            </ul>

            <h2 id="ugc" className="mt-10 text-2xl font-semibold">User Reviews & Content</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>By posting reviews, photos, or comments, you grant us a non-exclusive, royalty-free licence to use them for marketing and display.</li>
              <li>We may moderate or remove content that is illegal, infringing, misleading, or violates these Terms.</li>
            </ul>

            <h2 id="conduct" className="mt-10 text-2xl font-semibold">Acceptable Use & Prohibited Activities</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>No scraping, malware injection, bypassing security, or fraudulent activity.</li>
              <li>No infringement of third-party IP or violation of applicable law.</li>
              <li>No reselling or commercial use inconsistent with these Terms without permission.</li>
            </ul>

            <h2 id="force" className="mt-10 text-2xl font-semibold">Force Majeure</h2>
            <p className="text-white/80 mt-2">
              We are not liable for delays or failures caused by events beyond our reasonable control, including natural
              disasters, pandemics, labour disputes, acts of government, or internet outages.
            </p>

            <h2 id="liability" className="mt-10 text-2xl font-semibold">Warranty & Liability</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>Except as required by law, products are provided “as is” with manufacturer warranties where applicable.</li>
              <li>To the maximum extent permitted by law, our total liability for any claim will not exceed the amount you paid to us for the product/service in the 12 months preceding the claim.</li>
              <li>We are not liable for indirect, incidental, special, consequential, or punitive damages.</li>
            </ul>

            <h2 id="indemnity" className="mt-10 text-2xl font-semibold">Indemnification</h2>
            <p className="text-white/80 mt-2">
              You agree to indemnify and hold harmless VZOT Technologies and its officers, employees, and agents from claims
              arising out of your breach of these Terms, misuse of the site, or infringement of rights.
            </p>

            <h2 id="termination" className="mt-10 text-2xl font-semibold">Termination</h2>
            <p className="text-white/80 mt-2">
              We may suspend or terminate access for violations or suspected abuse. Provisions that naturally survive
              termination (e.g., IP and liability limits) remain in effect.
            </p>

            <h2 id="law" className="mt-10 text-2xl font-semibold">Governing Law & Disputes</h2>
            <p className="text-white/80 mt-2">
              These Terms are governed by the laws of India. Courts in New Delhi shall have exclusive jurisdiction, subject
              to applicable consumer protection laws. If arbitration is mandated by local law or a separate agreement, that procedure applies.
            </p>

            <h2 id="changes" className="mt-10 text-2xl font-semibold">Changes to Terms</h2>
            <p className="text-white/80 mt-2">
              We may update these Terms periodically. Continued use after changes constitutes acceptance of the updated Terms.
            </p>

            <h2 id="contact" className="mt-10 text-2xl font-semibold">Contact Us</h2>
            <p className="text-white/80 mt-2">
              <strong>VZOT Technologies</strong><br />
              Registered Office: Karol Bagh, New Delhi – 110005, India<br />
              Email: <a className="underline hover:opacity-80" href="mailto:support@vzot.in">support@vzot.in</a>{' '}• Phone: +91 93119 20369
            </p>

            <p className="mt-8 text-sm text-white/60">
              Related: <Link to="/privacy" className="underline hover:opacity-80">Privacy Policy</Link>
            </p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default Terms;
