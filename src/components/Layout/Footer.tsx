import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  ShieldCheck,
} from "lucide-react";

const Footer: React.FC = () => {
  const [email, setEmail] = useState("");

  return (
    <footer className="relative mt-12 text-white bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* subtle top divider */}
      <div className="h-px w-full bg-gradient-to-r from-white/10 via-white/20 to-white/10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* top row: brand + socials */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-10">
          <div className="flex items-center gap-3">
            <img
              src="/logo.webp"
              alt="VZOT"
              className="h-20 w-auto object-contain"
            />
            <div>
              <div className="text-xl font-bold tracking-wide">VZOT</div>
              <p className="text-sm text-white/60 -mt-0.5">
                Premium mobile accessories
              </p>
            </div>
          </div>
        </div>

        {/* middle grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* company blurb */}
          <div className="rounded-2xl border border-white/10 p-6 bg-white/5">
            <p className="text-sm text-white/70">
              Your trusted partner for chargers, cables, neckbands, TWS, ICs and
              more—quality products, fair pricing, fast dispatch.
            </p>

            {/* socials */}
            <div className="mt-5 flex items-center gap-4">
              <a
                href="https://www.facebook.com/jitukumarkothari/"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="p-2 rounded-lg border border-white/10 hover:bg-white/10"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/_nakodamobile_?t=yJpXFZwym_u7fbB_3ORckQ&s=08"
                target="_blank"
                rel="noreferrer"
                aria-label="Twitter"
                className="p-2 rounded-lg border border-white/10 hover:bg-white/10"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/v2m_nakoda_mobile/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="p-2 rounded-lg border border-white/10 hover:bg-white/10"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://www.youtube.com/@V2MNakodaMobile"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="p-2 rounded-lg border border-white/10 hover:bg-white/10"
              >
                <Youtube className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
              <ShieldCheck className="h-4 w-4" />
              Secure checkout • GST invoice
            </div>
          </div>

          {/* quick links */}
          <div className="rounded-2xl border border-white/10 p-6 bg-white/5">
            <h3 className="text-sm font-semibold tracking-wide mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/products" className="text-white/80 hover:text-sky-300">
                  All Products
                </Link>
              </li>
              <li>
                <Link to="/categories" className="text-white/80 hover:text-sky-300">
                  Categories
                </Link>
              </li>
              <li>
                <Link to="/oem" className="text-white/80 hover:text-sky-300">
                  OEM Services
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-white/80 hover:text-sky-300">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-white/80 hover:text-sky-300">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* categories */}
          <div className="rounded-2xl border border-white/10 p-6 bg-white/5">
            <h3 className="text-sm font-semibold tracking-wide mb-4">
              Categories
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/products?categorySlug=tws" className="text-white/80 hover:text-sky-300">
                  TWS Earbuds
                </Link>
              </li>
              <li>
                <Link
                  to="/products?categorySlug=bluetooth-neckband"
                  className="text-white/80 hover:text-sky-300"
                >
                  Bluetooth Neckbands
                </Link>
              </li>
              <li>
                <Link
                  to="/products?categorySlug=data-cables"
                  className="text-white/80 hover:text-sky-300"
                >
                  Data Cables
                </Link>
              </li>
              <li>
                <Link
                  to="/products?categorySlug=mobile-chargers"
                  className="text-white/80 hover:text-sky-300"
                >
                  Mobile Chargers
                </Link>
              </li>
              <li>
                <Link to="/products?categorySlug=ics" className="text-white/80 hover:text-sky-300">
                  Mobile ICs
                </Link>
              </li>
              <li>
                <Link
                  to="/products?categorySlug=repair-tools"
                  className="text-white/80 hover:text-sky-300"
                >
                  Repair Tools
                </Link>
              </li>
            </ul>
          </div>

          {/* contact */}
          <div className="rounded-2xl border border-white/10 p-6 bg-white/5">
            <h3 className="text-sm font-semibold tracking-wide mb-4">Contact</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-sky-300 mt-0.5" />
                <span className="text-white/80">
                  Building No. 3372/2, Gali No. 2, Christian Colony, Karol Bagh,
                  Near Baptist Church, 110005
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-sky-300" />
                <a href="tel:+919667960044" className="text-white hover:text-sky-300">
                  +91 96679 60044
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-sky-300" />
                <a
                  href="mailto:support@nakodamobile.in"
                  className="text-white hover:text-sky-300"
                >
                  support@nakodamobile.in
                </a>
              </div>
            </div>
            <div className="mt-5 text-[11px] text-white/60">Tue–Sun 11:00–20:00 IST</div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-10 flex flex-col-reverse items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Vzot. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/privacy" className="text-white/80 hover:text-sky-300">
              Privacy Policy
            </Link>
            <span className="text-white/20">•</span>
            <Link to="/terms" className="text-white/80 hover:text-sky-300">
              Terms of Service
            </Link>
            <span className="text-white/20">•</span>
            <Link to="/shipping" className="text-white/80 hover:text-sky-300">
              Shipping & Returns
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
