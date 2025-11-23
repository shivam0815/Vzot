// src/pages/OEM.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Users, Package, Truck, Award, CheckCircle,
  Mail, Phone, User, MessageSquare, Star
} from 'lucide-react';
import SEO from '../components/Layout/SEO';
import { oemService } from '../services/oemService';
import toast from 'react-hot-toast';

import { generateResponsiveImageUrl } from '../utils/cloudinaryBrowser';

const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(e.trim());
const isPhone10 = (p: string) => /^\d{10}$/.test(p.trim());

const CATEGORIES = [
  'TWS',
  'Bluetooth Neckbands',
  'Data Cables',
  'Mobile Chargers',
  'Mobile ICs',
  'Mobile Repairing Tools',
  'Car Charger',
  'Bluetooth Speaker',
  'Power Bank',
  'Custom',
] as const;

// ——— product typing for the strips ———
type Product = {
  _id: string;
  name: string;
  slug?: string;
  price: number;
  originalPrice?: number;
  images?: string[];
  imageUrl?: string;         // some APIs use single image field
  rating?: number;
  category?: string;
  status?: string;
};

const priceOffPct = (price?: number, original?: number) => {
  if (!price || !original || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
};

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

const OEM: React.FC = () => {
  const navigate = useNavigate();

  // -------- form state ----------
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    productCategory: '',
    quantity: '',
    customization: '',
    message: '',
    website: '', // honeypot
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'phone' ? value.replace(/[^\d]/g, '') : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot
    if (formData.website) return;

    if (!formData.companyName.trim()) return toast.error('Company name is required');
    if (!formData.contactPerson.trim()) return toast.error('Contact person is required');
    if (!isEmail(formData.email)) return toast.error('Please enter a valid email');
    if (!isPhone10(formData.phone)) return toast.error('Enter a 10-digit phone number');
    if (!formData.productCategory) return toast.error('Select a product category');
    if (!formData.quantity || Number(formData.quantity) < 100) {
      return toast.error('Minimum order quantity is 100');
    }
    if (!formData.customization.trim()) return toast.error('Describe customization requirements');

    setIsSubmitting(true);
    try {
      await oemService.createInquiry({
        companyName: formData.companyName.trim(),
        contactPerson: formData.contactPerson.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        productCategory: formData.productCategory as (typeof CATEGORIES)[number],
        quantity: Number(formData.quantity),
        customization: formData.customization.trim(),
        message: formData.message?.trim(),
      });

      toast.success('Thanks! Your inquiry has been submitted.');
      setFormData({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        productCategory: '',
        quantity: '',
        customization: '',
        message: '',
        website: '',
      });
    } catch (err: any) {
      if (err?.message) toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------- sales strips state ----------
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);
  const [errTop, setErrTop] = useState('');

  const fetchTopProducts = async () => {
    try {
      setLoadingTop(true);
      setErrTop('');
      // Tweak this to your backend route/params
      const res = await fetch(
        `${API_BASE}/products?limit=8&sort=trending&status=active`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to load products');
      // Normalize: many backends return { products } or { items }
      const items: Product[] = data.products || data.items || [];
      setTopProducts(items);
    } catch (e: any) {
      setErrTop(e?.message || 'Could not load products');
    } finally {
      setLoadingTop(false);
    }
  };

  useEffect(() => {
    fetchTopProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trialProducts = useMemo(() => {
    // Pick affordable “test buy” items first; fallback to first 4
    const cheap = topProducts.filter(p => (p.price ?? 0) <= 599);
    const pick = (cheap.length ? cheap : topProducts).slice(0, 4);
    return pick;
  }, [topProducts]);

  const productImage = (p: Product) => {
    const raw = p.images?.[0] || p.imageUrl;
    if (!raw) return undefined;
    try {
      return generateResponsiveImageUrl(raw, { width: 400, height: 400, crop: 'fill' });
    } catch {
      return raw; // if helper not available
    }
  };

  const goToProduct = (p: Product) => {
    const slugOrId = p.slug || p._id;
    navigate(`/product/${slugOrId}`);
  };

  const services = [
    { icon: Package, title: 'Bulk Manufacturing', description: 'Large-scale production with competitive pricing and QA.' },
    { icon: Award, title: 'Custom Branding', description: 'Your logo + pro packaging and design services.' },
    { icon: Truck, title: 'Global Shipping', description: 'Worldwide delivery with tracking and insurance.' },
    { icon: Users, title: 'Dedicated Support', description: ' Support with a  account manager. ' },
  ];

  const features = [
    'Minimum Order Quantity: 50 pieces',
    'Custom packaging and branding',
    'Quality assurance and testing',
    'Competitive wholesale pricing',
    'Fast turnaround times',
    'Global shipping available',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO
        title="OEM Services"
        description="Bulk manufacturing, custom branding & white-label mobile accessories. Get an OEM quote from Nakoda Mobile."
        canonicalPath="/oem"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'OEM Mobile Accessories',
          areaServed: 'IN',
          provider: { '@type': 'Organization', name: 'Nakoda Mobile' }
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
            className="text-4xl md:text-6xl font-bold mb-6"
          >
            OEM Services <span className="block text-yellow-400">For Your Business</span>
          </motion.h1>
          <p className="text-xl mb-8 text-gray-200 max-w-3xl mx-auto">
            Partner with Nakoda Mobile for bulk manufacturing, custom branding, and white-label solutions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://nakodamobile.in/oem" className="bg-yellow-400 text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-yellow-300">
              Get Quote
            </a>
            <a href="#services" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-gray-900">
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our OEM Services</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Comprehensive solutions to scale with premium mobile accessories</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl shadow-lg p-6 text-center hover:shadow-xl"
              >
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <s.icon className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-gray-600">{s.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

     
      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Why Choose Our OEM Services?</h2>
            <p className="text-gray-600 mb-8">End-to-end solutions to expand your product offerings with high-quality mobile accessories.</p>
            <div className="space-y-4">
              {features.map((f, i) => (
                <div key={i} className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <span className="text-gray-700">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <img
              src="https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=600"
              alt="OEM Manufacturing"
              className="rounded-lg shadow-xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent rounded-lg"></div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact-form" className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Get Your Custom Quote</h2>
            <p className="text-gray-600">Fill out the form and our team will get back to you within 24 hours</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* Honeypot */}
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="companyName"
                      required
                      value={formData.companyName}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      autoComplete="organization"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      placeholder="Enter company name"
                    />
                    <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person *</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="contactPerson"
                      required
                      value={formData.contactPerson}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      autoComplete="name"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      placeholder="Enter contact person name"
                    />
                    <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                  <div className="relative">
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      placeholder="Enter email"
                    />
                    <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <div className="relative">
                    <input
                      type="tel"
                      name="phone"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      inputMode="numeric"
                      pattern="\d{10}"
                      autoComplete="tel"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                      placeholder="10-digit phone"
                    />
                    <Phone className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product Category *</label>
                  <select
                    name="productCategory"
                    required
                    value={formData.productCategory}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity Required *</label>
                  <input
                    type="number"
                    name="quantity"
                    required
                    min={100}
                    value={formData.quantity}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    placeholder="Minimum 100 pieces"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customization Requirements *</label>
                <textarea
                  name="customization"
                  required
                  rows={3}
                  value={formData.customization}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  placeholder="Branding, packaging, colors, specs…"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Message</label>
                <div className="relative">
                  <textarea
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    placeholder="Any additional requirements or questions"
                  />
                  <MessageSquare className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Inquiry'}
              </motion.button>
            </form>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Scale Your Business?</h2>
          <p className="text-xl mb-8 max-w-3xl mx-auto">Join hundreds of businesses worldwide who trust Nakoda Mobile.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="tel:+919876543210" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 inline-flex items-center justify-center">
              <Phone className="h-5 w-5 mr-2" /> Call Now: +919667960044
            </a>
            <a href="mailto:oem@nakodamobile.com" className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 inline-flex items-center justify-center">
              <Mail className="h-5 w-5 mr-2" /> Email: support@nakodamobile.in
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OEM;
