// src/pages/Privacy.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/Layout/SEO';

const Privacy: React.FC = () => {
  const LAST_UPDATED = '20 Aug 2025';

  const sections: Array<[string, string]> = [
    ['intro','Introduction'],
    ['info','What We Collect'],
    ['use','How We Use Information'],
    ['legal','Legal Bases (GDPR)'],
    ['cookies','Cookies & Tracking'],
    ['third','Third-Party Processors'],
    ['retention','Data Retention'],
    ['rights','Your Rights'],
    ['regional','Regional Notices (GDPR / CCPA / India)'],
    ['security','Data Security'],
    ['children','Children’s Privacy'],
    ['prefs','Managing Preferences'],
    ['changes','Changes to this Policy'],
    ['contact','Contact / Grievance Officer'],
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
        title="Privacy Policy — VZOT Technologies"
        description="How VZOT Technologies collects, uses, shares, and protects your information."
        canonicalPath="/privacy"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Privacy Policy — VZOT Technologies',
          url: 'https://vzot.in/privacy'
        }}
      />

      {/* Hero */}
      <section className="pt-16 pb-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-10 shadow-[0_15px_50px_rgba(0,0,0,0.25)]">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Privacy Policy</h1>
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
                    <a href={`#${id}`} className="text-white/70 hover:text-white">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Article */}
          <article className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 md:p-8 leading-relaxed">
            <p id="intro" className="text-white/80">
              This Privacy Policy explains how <strong>VZOT Technologies</strong> (“we”, “us”, “our”)
              collects, uses, shares, and protects your information when you visit our website, shop products,
              subscribe to our newsletter, submit OEM inquiries, or contact support. By using our site,
              you agree to this Policy and our <Link to="/terms" className="underline hover:opacity-80">Terms &amp; Conditions</Link>.
            </p>

            <h2 id="info" className="mt-10 text-2xl font-semibold">What We Collect</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li><strong>Account &amp; Profile</strong>: name, email, phone, shipping/billing addresses.</li>
              <li><strong>Orders</strong>: items purchased, amounts, delivery info, order history.</li>
              <li><strong>Payments</strong>: payment status and references from gateway (we don’t store full card data).</li>
              <li><strong>OEM Inquiries</strong>: company name, contact person, email, phone, category, quantity, customization, message.</li>
              <li><strong>Newsletter</strong>: email address and subscription status.</li>
              <li><strong>Support</strong>: messages, attachments, correspondence.</li>
              <li><strong>Device/Usage</strong>: IP, device, browser, pages viewed, referrer (analytics and security).</li>
              <li><strong>Cookies</strong>: session IDs, preferences, analytics, and marketing tags.</li>
            </ul>

            <h2 id="use" className="mt-10 text-2xl font-semibold">How We Use Information</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>Process and deliver orders; manage returns and warranty.</li>
              <li>Provide OEM quotes, artwork proofing, and production updates.</li>
              <li>Send transactional emails/SMS (order updates, invoices, support).</li>
              <li>Send marketing emails (only if opted-in) and show relevant offers.</li>
              <li>Improve products, services, and site performance (analytics).</li>
              <li>Detect, prevent, and investigate fraud or abuse.</li>
              <li>Comply with legal obligations and enforce our Terms.</li>
            </ul>

            <h2 id="legal" className="mt-10 text-2xl font-semibold">Legal Bases (GDPR)</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li><strong>Contract</strong>: to fulfill orders, OEM services, and requested support.</li>
              <li><strong>Consent</strong>: newsletters, certain cookies/marketing.</li>
              <li><strong>Legitimate Interests</strong>: security, analytics, service improvement.</li>
              <li><strong>Legal Obligation</strong>: tax, accounting, and compliance purposes.</li>
            </ul>

            <h2 id="cookies" className="mt-10 text-2xl font-semibold">Cookies &amp; Tracking</h2>
            <p className="text-white/80 mt-2">We use cookies and similar technologies:</p>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li><strong>Essential</strong> – authentication, cart, checkout.</li>
              <li><strong>Functional</strong> – remembering preferences.</li>
              <li><strong>Analytics</strong> – site usage and performance.</li>
              <li><strong>Marketing</strong> – newsletters, promotions, retargeting ads.</li>
            </ul>
            <p className="text-white/70 mt-2">
              You can control cookies in your browser and through our cookie settings (if configured).
              Blocking essential cookies may affect core features.
            </p>

            <h2 id="third" className="mt-10 text-2xl font-semibold">Third-Party Processors</h2>
            <p className="text-white/80 mt-2">We may share limited data with trusted vendors strictly to provide our services:</p>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li><strong>Payment gateway</strong> (e.g., Razorpay/Stripe) – payment processing.</li>
              <li><strong>Email service</strong> (e.g., SMTP/Mailgun/SendGrid) – transactional &amp; marketing emails.</li>
              <li><strong>Cloud media</strong> (e.g., Cloudinary/S3+CDN) – product image hosting &amp; optimization.</li>
              <li><strong>Analytics</strong> (e.g., Google Analytics) – usage measurement.</li>
              <li><strong>Shipping partners</strong> – delivery and tracking.</li>
              <li><strong>Customer support</strong> – ticketing or chat (if enabled).</li>
            </ul>
            <p className="text-white/70 mt-2">Each vendor must protect your data and use it only for the specified purpose.</p>

            <h2 id="retention" className="mt-10 text-2xl font-semibold">Data Retention</h2>
            <div className="overflow-x-auto not-prose mt-2">
              <table className="w-full text-sm border border-white/10 rounded-lg overflow-hidden">
                <thead className="bg-white/10 text-white/80">
                  <tr>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Typical Retention</th>
                    <th className="p-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {[
                    ['Orders & invoices','7–10 years','Tax & accounting laws'],
                    ['Account profile','While account is active','Provide services; you can request deletion'],
                    ['OEM inquiries','24–36 months','Follow-ups and quoting history'],
                    ['Support messages','24 months','Quality assurance & dispute handling'],
                    ['Newsletter list','Until you unsubscribe','Marketing preferences'],
                    ['Analytics logs','12–24 months','Trend analysis & security'],
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

            <h2 id="rights" className="mt-10 text-2xl font-semibold">Your Rights</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li>Access, correct, or delete your data (subject to legal limits).</li>
              <li>Object to processing or request restriction in certain cases.</li>
              <li>Data portability in a machine-readable format.</li>
              <li>Withdraw consent for marketing at any time.</li>
              <li>Opt-out of “sale”/“share” where applicable (CCPA).</li>
            </ul>
            <p className="text-white/70 mt-2">To exercise rights, contact us using the details below. We may need to verify your identity.</p>

            <h2 id="regional" className="mt-10 text-2xl font-semibold">Regional Notices (GDPR / CCPA / India DPDP)</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li><strong>GDPR (EU/EEA/UK)</strong>: We rely on the legal bases above and may transfer data using safeguards such as SCCs.</li>
              <li><strong>CCPA/CPRA (California)</strong>: Rights to know, delete, correct, and opt-out of sale/share of personal info.</li>
              <li><strong>India DPDP</strong>: We process data as a Data Fiduciary; you may exercise rights to access, correction, and grievance redressal.</li>
            </ul>

            <h2 id="security" className="mt-10 text-2xl font-semibold">Data Security</h2>
            <p className="text-white/80 mt-2">
              We implement administrative, technical, and physical safeguards (e.g., HTTPS/TLS, access controls).
              No method is 100% secure; we continually improve protections.
            </p>

            <h2 id="children" className="mt-10 text-2xl font-semibold">Children’s Privacy</h2>
            <p className="text-white/80 mt-2">
              Our services are not directed to children under the age required by applicable law.
              If you believe a child has provided data to us, contact us to delete it.
            </p>

            <h2 id="prefs" className="mt-10 text-2xl font-semibold">Managing Preferences</h2>
            <ul className="mt-2 list-disc pl-5 text-white/80 space-y-2">
              <li><strong>Newsletter</strong>: use the “unsubscribe” link in any email.</li>
              <li><strong>Cookies</strong>: adjust browser settings and our cookie banner (if available).</li>
              <li><strong>Account</strong>: update profile details in your account area.</li>
            </ul>

            <h2 id="changes" className="mt-10 text-2xl font-semibold">Changes to this Policy</h2>
            <p className="text-white/80 mt-2">
              We may update this Policy. We’ll update the “Last updated” date and, where required,
              notify you via email or site banner.
            </p>

            <h2 id="contact" className="mt-10 text-2xl font-semibold">Contact / Grievance Officer</h2>
            <p className="text-white/80 mt-2">
              <strong>VZOT Technologies</strong><br />
              Registered Office: Karol Bagh, New Delhi – 110005, India<br />
              Email: <a href="mailto:privacy@vzot.in" className="underline hover:opacity-80">privacy@vzot.in</a>{' '}• Phone: +91 93119 20369<br />
              For India DPDP grievances, please mention “DPDP Grievance” in your email subject.
            </p>

            <p className="mt-8 text-sm text-white/60">
              Related: <Link to="/terms" className="underline hover:opacity-80">Terms &amp; Conditions</Link>
            </p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
