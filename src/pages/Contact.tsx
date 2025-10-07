// src/pages/Contact.tsx
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  MessageSquare,
  User,
  Building2,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  CheckCircle,
  Copy,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { contactService } from '../services/contactService';

// ---------------- Contact constants (single source of truth)
const ADDRESS_TEXT =
  'Building No.3372, Gali No.2, Christian Colony, Karol Bagh Near Baptist Church, New Delhi, 110005';
const MAPS_Q = encodeURIComponent(`${ADDRESS_TEXT} Nakoda Mobile`);
const MAPS_VIEW = `https://www.google.com/maps?q=${MAPS_Q}`;
const MAPS_EMBED = `${MAPS_VIEW}&output=embed`;

const PHONE_PRIMARY = '9650516703';
const PHONE_SECONDARY = '9667960044';
const TEL_PRIMARY = `tel:+91${PHONE_PRIMARY}`;
const TEL_SECONDARY = `tel:+91${PHONE_SECONDARY}`;

// WhatsApp format: no plus sign in path; optional pre-filled message
const WA_MSG = encodeURIComponent('Hi Nakoda Mobile, I have an enquiry.');
const WA_PRIMARY = `https://wa.me/91${PHONE_PRIMARY}?text=${WA_MSG}`;

const EMAIL_SUPPORT = 'support@nakodamobile.in';
const EMAIL_OEM = 'oem@nakodamobile.in';

// ---------------- Types
type DeptValue =
  | 'general'
  | 'support'
  | 'oem'
  | 'wholesale'
  | 'technical'
  | 'partnership';

const isEmail = (e: string) => /^[^\s@]+@[^\s@]{2,}\.[^\s@]{2,}$/i.test(e.trim());
const is10DigitPhone = (p: string) => /^\d{10}$/.test(p);

type FormState = {
  name: string;
  email: string;
  phone: string;
  subject: '' | DeptValue;
  message: string;
  website: string; // honeypot
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const Contact: React.FC = () => {
  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    website: '', // honeypot (must remain empty)
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  // --- derived values
  const msgChars = formData.message.length;
  const msgTooShort = msgChars > 0 && msgChars < 10;

  // --- validation
  const validate = (data: FormState): FormErrors => {
    const errs: FormErrors = {};
    if (!data.name.trim()) errs.name = 'Name is required';
    if (!isEmail(data.email)) errs.email = 'Valid email required';
    if (!data.subject) errs.subject = 'Please select a department';
    if (!data.message.trim()) errs.message = 'Message is required';
    if (msgTooShort) errs.message = 'Please enter at least 10 characters';
    if (data.phone && !is10DigitPhone(data.phone.trim())) errs.phone = 'Phone must be 10 digits';
    if (data.website) errs.website = 'Spam detected';
    return errs;
  };

  const [errors, setErrors] = useState<FormErrors>({});

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target;
    setErrors(prev => ({ ...prev, [name]: validate(formData)[name as keyof FormState] }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'phone' ? value.replace(/[^\d]/g, '') : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate(formData);
    setErrors(v);
    if (Object.keys(v).length) {
      const firstErr = Object.values(v)[0];
      if (firstErr) toast.error(firstErr);
      return;
    }

    setIsSubmitting(true);
    setSentOk(false);
    try {
      await contactService.send({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        subject: formData.subject as DeptValue,
        message: formData.message.trim(),
        website: formData.website, // honeypot (empty for humans)
      });

      setSentOk(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        website: '',
      });
    } catch {
      // toasts handled in service
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- contact info cards
  type ContactCard = {
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
    details: Array<{ text: string; href?: string }>;
  };

  const contactCards: ContactCard[] = [
    {
      icon: MapPin,
      title: 'Visit Our Store',
      details: [{ text: ADDRESS_TEXT, href: MAPS_VIEW }],
    },
    {
      icon: Phone,
      title: 'Call Us',
      details: [
        { text: `+91 ${PHONE_PRIMARY}`, href: TEL_PRIMARY },
        { text: `+91 ${PHONE_SECONDARY}`, href: TEL_SECONDARY },
        { text: `WhatsApp: +91 ${PHONE_PRIMARY}`, href: WA_PRIMARY },
        { text: 'Tue–Sun: 11:00 AM – 8:00 PM' },
      ],
    },
    {
      icon: Mail,
      title: 'Email Us',
      details: [
        { text: EMAIL_SUPPORT, href: `mailto:${EMAIL_SUPPORT}` },
        { text: EMAIL_OEM, href: `mailto:${EMAIL_OEM}` },
      ],
    },
    {
      icon: Clock,
      title: 'Business Hours',
      details: [
        { text: 'Tuesday – Sunday: 11:00 AM – 8:00 PM' },
     
      ],
    },
  ];

  const departments: { value: DeptValue; label: string }[] = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Customer Support' },
    { value: 'oem', label: 'OEM Services' },
    { value: 'wholesale', label: 'Wholesale Inquiry' },
    { value: 'technical', label: 'Technical Support' },
    { value: 'partnership', label: 'Partnership' },
  ];

  const faqs = [
    {
      question: 'What is your return policy?',
      answer:
        'We offer a 07-day return policy for all products. Items must be in original condition with packaging.',
    },
    {
      question: 'Do you provide warranty on products?',
      answer:
        'Yes, all our products come with manufacturer warranty. Warranty period varies by product category.',
    },
    {
      question: 'How long does shipping take?',
      answer:
        'Standard shipping takes 3–5 business days. Express shipping is available for faster delivery.',
    },
    {
      question: 'Do you offer bulk discounts?',
      answer:
        'Yes, we provide attractive discounts for bulk orders. Contact our OEM team for custom pricing.',
    },
  ];

  // copy helpers
  const [copied, setCopied] = useState<string>('');
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1500);
      toast.success('Copied!');
    } catch {
      toast.error('Copy failed');
    }
  };

  // JSON-LD (LocalBusiness)
  const jsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Nakoda Mobile',
      image: '/favicon-512.png',
      address: {
        '@type': 'PostalAddress',
        streetAddress:
          'Building No.3372, Gali No.2, Christian Colony, Karol Bagh Near Baptist Church',
        addressLocality: 'New Delhi',
        postalCode: '110005',
        addressCountry: 'IN',
      },
      telephone: `+91${PHONE_SECONDARY}`,
      email: EMAIL_SUPPORT,
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '11:00',
          closes: '20:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: 'Monday',
          opens: '00:00',
          closes: '00:00',
        }, // Closed
      ],
      sameAs: [
        'https://www.facebook.com/jitukumarkothari/',
        'https://x.com/_nakodamobile_?t=yJpXFZwym_u7fbB_3ORckQ&s=08',
        'https://www.instagram.com/v2m_nakoda_mobile/',
        'https://www.youtube.com/@V2MNakodaMobile',
      ],
    }),
    []
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Get in Touch</h1>
            <p className="text-xl mb-8 text-gray-200 max-w-3xl mx-auto">
              Have questions? We’d love to hear from you. Send us a message and we’ll respond as soon as
              possible.
            </p>
            <div className="inline-flex items-center gap-2 bg-white/15 px-4 py-2 rounded-full text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-300" />
              Typical response time: under 24 hours
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {contactCards.map((info, index) => (
              <motion.div
                key={info.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="relative rounded-xl p-6 text-center border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-50 to-transparent opacity-50" />
                <div className="relative">
                  <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <info.icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{info.title}</h3>
                  <div className="space-y-1">
                    {info.details.map((d, i) => (
                      <div key={i} className="flex items-center justify-center gap-2 text-sm">
                        {d.href ? (
                          <>
                            <a
  href={d.href}
  target="_blank"
  rel="noopener noreferrer"
  className="text-blue-600 hover:text-blue-700 break-words whitespace-normal"
>
  {d.text}
</a>

                            <button
                              type="button"
                              onClick={() => handleCopy(d.text)}
                              className="inline-flex items-center rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                              title="Copy"
                            >
                              {copied === d.text ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </>
                        ) : (
                          <span className="text-gray-600">{d.text}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Map */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Send us a Message</h2>

                {sentOk && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 flex items-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Thank you! Your message has been sent. We’ll get back to you shortly.
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                  {/* honeypot */}
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
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          id="name"
                          name="name"
                          autoComplete="name"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className={
                            'w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                            (errors.name ? 'border-rose-300' : 'border-gray-300')
                          }
                          placeholder="Enter your full name"
                        />
                        <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                      </div>
                      {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name}</p>}
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          id="email"
                          name="email"
                          autoComplete="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className={
                            'w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                            (errors.email ? 'border-rose-300' : 'border-gray-300')
                          }
                          placeholder="Enter your email"
                        />
                        <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                      </div>
                      {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          inputMode="numeric"
                          autoComplete="tel"
                          value={formData.phone}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          maxLength={10}
                          className={
                            'w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                            (errors.phone ? 'border-rose-300' : 'border-gray-300')
                          }
                          placeholder="10-digit number"
                        />
                        <Phone className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                      </div>
                      {errors.phone && <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>}
                    </div>

                    <div>
                      <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                        Department *
                      </label>
                      <div className="relative">
                        <select
                          id="subject"
                          name="subject"
                          required
                          value={formData.subject}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className={
                            'w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                            (errors.subject ? 'border-rose-300' : 'border-gray-300')
                          }
                        >
                          <option value="">Select department</option>
                          {[
                            { value: 'general', label: 'General Inquiry' },
                            { value: 'support', label: 'Customer Support' },
                            { value: 'oem', label: 'OEM Services' },
                            { value: 'wholesale', label: 'Wholesale Inquiry' },
                            { value: 'technical', label: 'Technical Support' },
                            { value: 'partnership', label: 'Partnership' },
                          ].map((dept) => (
                            <option key={dept.value} value={dept.value}>
                              {dept.label}
                            </option>
                          ))}
                        </select>
                        <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                      </div>
                      {errors.subject && <p className="mt-1 text-xs text-rose-600">{errors.subject}</p>}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      Message *
                    </label>
                    <div className="relative">
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={6}
                        maxLength={1000}
                        value={formData.message}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        className={
                          'w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
                          (errors.message ? 'border-rose-300' : 'border-gray-300')
                        }
                        placeholder="Tell us how we can help you..."
                        aria-describedby="message-help"
                      />
                      <MessageSquare className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span id="message-help" className={msgTooShort ? 'text-rose-600' : 'text-gray-500'}>
                        {msgTooShort ? 'Please enter at least 10 characters' : 'Be as detailed as possible'}
                      </span>
                      <span className="text-gray-400">{msgChars}/1000</span>
                    </div>
                    {errors.message && <p className="mt-1 text-xs text-rose-600">{errors.message}</p>}
                  </div>

                  <motion.button
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    aria-busy={isSubmitting}
                    aria-live="polite"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-b-transparent" />
                        <span>Sending…</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        <span>Send Message</span>
                      </>
                    )}
                  </motion.button>
                </form>
              </div>
            </motion.div>

            {/* Map & Additional Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              {/* Map */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="h-64">
                  <iframe
                    title="Nakoda Mobile Location"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full h-full"
                    src={MAPS_EMBED}
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Visit Our Store</h3>
                  <p className="text-gray-600 mb-4">
                    Come visit our physical store to see our products in person and get expert advice from our team.
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                      Free Parking
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                      Expert Staff
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Follow Us</h3>
                <p className="text-gray-600 mb-6">
                  Stay connected with us on social media for the latest updates, offers, and tech news.
                </p>
                <div className="flex space-x-4">
                  {[
                    { icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-100', href: 'https://www.facebook.com/jitukumarkothari/' },
                    { icon: Twitter, color: 'text-blue-400', bg: 'bg-blue-50', href: 'https://x.com/_nakodamobile_?t=yJpXFZwym_u7fbB_3ORckQ&s=08' },
                    { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-100', href: 'https://www.instagram.com/v2m_nakoda_mobile/' },
                    { icon: Youtube, color: 'text-red-600', bg: 'bg-red-100', href: 'https://www.youtube.com/@V2MNakodaMobile' },
                  ].map((social, index) => (
                    <a
                      key={index}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${social.bg} ${social.color} p-3 rounded-lg hover:scale-110 transition-transform duration-200`}
                      aria-label="Visit our social profile"
                    >
                      <social.icon className="h-6 w-6" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Quick Contact */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4">Need Immediate Help?</h3>
                <p className="mb-4">For urgent inquiries, call us directly or chat with our support team.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={TEL_SECONDARY}
                    className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors duration-200 text-center"
                  >
                    Call Now
                  </a>
                  <a
                    href={WA_PRIMARY}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-2 border-white text-white px-4 py-2 rounded-lg font-medium hover:bg-white hover:text-blue-600 transition-colors duration-200 text-center"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-600">Quick answers to common questions</p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <motion.details
                key={faq.question}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-50 rounded-lg p-6 group open:bg-gray-100"
              >
                <summary className="cursor-pointer select-none text-lg font-semibold text-gray-900 mb-2 list-none flex items-center justify-between">
                  {faq.question}
                  <span className="ml-4 text-sm text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="text-gray-700">{faq.answer}</p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
