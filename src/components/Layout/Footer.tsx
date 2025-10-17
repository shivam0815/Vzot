import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Smartphone, 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Youtube 
} from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
           <div className="flex items-center space-x-2 mb-4">
  <div className="bg-blue-600 p-2 rounded-lg">
    <img
      src="/logo.png"  // change to your actual image path
      alt="Nakoda Mobile Logo"
      className="h-6 w-6"
    />
  </div>
  <span className="text-2xl font-bold">
    Nakoda<span className="text-blue-400">Mobile</span>
  </span>
</div>

            <p className="text-gray-300 mb-4">
              Your trusted partner for premium mobile accessories and OEM services. 
              Quality products, competitive prices, and exceptional service.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.facebook.com/jitukumarkothari/" className="text-gray-300 hover:text-blue-400 transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://x.com/_nakodamobile_?t=yJpXFZwym_u7fbB_3ORckQ&s=08" className="text-gray-300 hover:text-blue-400 transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://www.instagram.com/v2m_nakoda_mobile/" className="text-gray-300 hover:text-blue-400 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://www.youtube.com/@V2MNakodaMobile" className="text-gray-300 hover:text-blue-400 transition-colors">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link to="/products" className="text-gray-300 hover:text-white transition-colors">All Products</Link></li>
              <li><Link to="/categories" className="text-gray-300 hover:text-white transition-colors">Categories</Link></li>
              <li><Link to="/oem" className="text-gray-300 hover:text-white transition-colors">OEM Services</Link></li>
              <li><Link to="/about" className="text-gray-300 hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="text-gray-300 hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Categories</h3>
            <ul className="space-y-2">
              <li><Link to="/products?category=tws" className="text-gray-300 hover:text-white transition-colors">TWS Earbuds</Link></li>
              <li><Link to="/products?category=Bluetooth Neckbands" className="text-gray-300 hover:text-white transition-colors">Bluetooth Neckbands</Link></li>
              <li><Link to="/products?category=Data Cable" className="text-gray-300 hover:text-white transition-colors">Data Cables</Link></li>
              <li><Link to="/products?category=Mobile Chargers" className="text-gray-300 hover:text-white transition-colors">Mobile Chargers</Link></li>
              <li><Link to="/products?category=ics" className="text-gray-300 hover:text-white transition-colors">Mobile ICs</Link></li>
              <li><Link to="/products?category=Mobile Repairing Tools" className="text-gray-300 hover:text-white transition-colors">Repair Tools</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-blue-400" />
                <span className="text-gray-300">Building No.3372/2, Gali No. 2 Christian Colony Karol Bagh Near baptist church , 110005</span>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-blue-400" />
                <span className="text-gray-300">9667960044</span>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-blue-400" />
                <span className="text-gray-300">support@nakodamobile.in</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-300">
            © 2025 Nakoda Mobile. All rights reserved. | 
            <Link to="/privacy" className="text-blue-400 hover:text-blue-300 ml-2">Privacy Policy</Link> | 
            <Link to="/terms" className="text-blue-400 hover:text-blue-300 ml-2">Terms of Service</Link>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;