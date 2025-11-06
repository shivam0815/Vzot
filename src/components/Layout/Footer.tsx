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
    <footer className="relative mt-12 bg-white text-gray-900">
      {/* subtle top divider */}
      <div className="h-px w-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* top row: brand + socials + small newsletter */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-10">
          <div className="flex items-center gap-3">
  <img
    src="/logo.webp"
    alt="VZOT"
    className="h-20 w-auto object-contain"
  />
  <div>
    <div className="text-xl font-bold tracking-wide">VZOT</div>
    <p className="text-sm text-gray-500 -mt-0.5">Premium mobile accessories</p>
  </div>
</div>


        
          
        </div>

        {/* middle grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* company blurb */}
          <div className="rounded-2xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600">
              Your trusted partner for chargers, cables, neckbands, TWS, ICs
              and more—quality products, fair pricing, fast dispatch.
            </p>

            {/* socials */}
            <div className="mt-5 flex items-center gap-4">
              <a
                href="https://www.facebook.com/jitukumarkothari/"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/_nakodamobile_?t=yJpXFZwym_u7fbB_3ORckQ&s=08"
                target="_blank"
                rel="noreferrer"
                aria-label="Twitter"
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/v2m_nakoda_mobile/"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://www.youtube.com/@V2MNakodaMobile"
                target="_blank"
                rel="noreferrer"
                aria-label="YouTube"
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Youtube className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <ShieldCheck className="h-4 w-4" />
              Secure checkout • GST invoice
            </div>
          </div>

          {/* quick links */}
          <div className="rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold tracking-wide text-gray-900 mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/products" className="hover:text-blue-600">
                  All Products
                </Link>
              </li>
              <li>
                <Link to="/categories" className="hover:text-blue-600">
                  Categories
                </Link>
              </li>
              <li>
                <Link to="/oem" className="hover:text-blue-600">
                  OEM Services
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-blue-600">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-blue-600">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* categories */}
          <div className="rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold tracking-wide text-gray-900 mb-4">
              Categories
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/products?categorySlug=tws" className="hover:text-blue-600">
                  TWS Earbuds
                </Link>
              </li>
              <li>
                <Link
                  to="/products?categorySlug=bluetooth-neckband"
                  className="hover:text-blue-600"
                >
                  Bluetooth Neckbands
                </Link>
              </li>
              <li>
                <Link
                  to="/products?categorySlug=data-cables"
                  className="hover:text-blue-600"
                >
                  Data Cables
                </Link>
              </li>
              <li>
                <Link
                  to="/products?categorySlug=mobile-chargers"
                  className="hover:text-blue-600"
                >
                  Mobile Chargers
                </Link>
              </li>
              <li>
                <Link to="/products?categorySlug=ics" className="hover:text-blue-600">
                  Mobile ICs
                </Link>
              </li>
              <li>
                <Link
                  to="/products?categorySlug=repair-tools"
                  className="hover:text-blue-600"
                >
                  Repair Tools
                </Link>
              </li>
            </ul>
          </div>

          {/* contact */}
          <div className="rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold tracking-wide text-gray-900 mb-4">
              Contact
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
                <span className="text-gray-600">
                  Building No. 3372/2, Gali No. 2, Christian Colony, Karol Bagh,
                  Near Baptist Church, 110005
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-blue-600" />
                <a href="tel:+919667960044" className="text-gray-700 hover:text-blue-600">
                  +91 96679 60044
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <a
                  href="mailto:support@nakodamobile.in"
                  className="text-gray-700 hover:text-blue-600"
                >
                  support@nakodamobile.in
                </a>
              </div>
            </div>
            <div className="mt-5 text-[11px] text-gray-500">
              Tue–Mon 11:00–20:00 IST
            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-10 flex flex-col-reverse items-center justify-between gap-4 border-t border-gray-200 pt-6 sm:flex-row">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Vzot. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/privacy" className="text-gray-600 hover:text-blue-600">
              Privacy Policy
            </Link>
            <span className="text-gray-300">•</span>
            <Link to="/terms" className="text-gray-600 hover:text-blue-600">
              Terms of Service
            </Link>
            <span className="text-gray-300">•</span>
            <Link to="/shipping" className="text-gray-600 hover:text-blue-600">
              Shipping & Returns
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
