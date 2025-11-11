// src/pages/Register.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Eye, EyeOff, Mail, Lock, User, Phone as PhoneIcon, Chrome, AlertCircle, CheckCircle, X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import VZOTBackground from '../components/Layout/VZOTBackground';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  agreeToTerms: boolean;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
  label: string;
}

const Register: React.FC = () => {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    agreeToTerms: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string>('');
  const [emailExists, setEmailExists] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  // -------- Password strength ----------
  const checkPasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    const feedback: string[] = [];
    if (password.length >= 8) score += 1; else feedback.push('At least 8 characters');
    if (/[a-z]/.test(password)) score += 1; else feedback.push('One lowercase letter');
    if (/[A-Z]/.test(password)) score += 1; else feedback.push('One uppercase letter');
    if (/\d/.test(password)) score += 1; else feedback.push('One number');
    if (/[^a-zA-Z\d]/.test(password)) score += 1; else feedback.push('One special character');

    const strengthMap = {
      0: { color: 'bg-gray-200', label: 'Enter password' },
      1: { color: 'bg-red-500', label: 'Very weak' },
      2: { color: 'bg-orange-500', label: 'Weak' },
      3: { color: 'bg-yellow-500', label: 'Fair' },
      4: { color: 'bg-blue-500', label: 'Good' },
      5: { color: 'bg-green-500', label: 'Strong' }
    };
    return {
      score,
      feedback,
      color: strengthMap[score as keyof typeof strengthMap].color,
      label: strengthMap[score as keyof typeof strengthMap].label
    };
  };
  const passwordStrength = checkPasswordStrength(formData.password);

  // -------- Handlers ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanedPhone = (formData.phone || '').replace(/\D/g, '');
    if (cleanedPhone.length < 7 || cleanedPhone.length > 15) {
      toast.error('Enter a valid phone number');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordStrength.score < 3) {
      toast.error('Please choose a stronger password');
      return;
    }

    if (!formData.agreeToTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    setIsLoading(true);
    try {
      await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: cleanedPhone
      });
      toast.success('Account created! Please check your email to verify your account.');
      navigate('/verify-email-sent', { state: { email: formData.email } });
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        setEmailExists(true);
        toast.error('An account with this email already exists');
      } else {
        toast.error(error.response?.data?.message || 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    setSocialLoading(provider);
    const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';
    const backendOrigin = apiBase.replace(/\/?api\/?$/, '');
    window.location.href = `${backendOrigin}/api/auth/${provider}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (name === 'email' && emailExists) setEmailExists(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Only gradient background */}
      <VZOTBackground />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-screen items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md rounded-[28px] bg-white/95 backdrop-blur-sm shadow-[0_20px_60px_rgba(2,6,23,0.18)] ring-1 ring-black/5 p-6 md:p-8"
          >
            <div className="text-center mb-2">
              <div className="mx-auto h-14 w-14 bg-[#33e49c] rounded-full flex items-center justify-center shadow-lg shadow-[#33e49c]/20 mb-4">
                <User className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">Create your account</h2>
              <p className="text-sm text-gray-600 mt-1">Join thousands of satisfied customers</p>
            </div>

            {/* Google only */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={socialLoading === 'google'}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#33e49c] disabled:opacity-50"
              >
                {socialLoading === 'google'
                  ? <div className="animate-spin h-5 w-5 border-2 border-[#33e49c] border-t-transparent rounded-full" />
                  : <Chrome className="h-5 w-5 text-[#103744]" />
                }
                <span className="text-gray-800 font-medium">Sign up with Google</span>
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-500">or create with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-800 mb-1.5">Full Name *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="name" name="name" type="text" autoComplete="name" required
                    value={formData.name} onChange={handleChange} placeholder="Enter your full name"
                    className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#33e49c] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-1.5">Email Address *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email" name="email" type="email" autoComplete="email" required
                    value={formData.email} onChange={handleChange} placeholder="Enter your email"
                    className={`block w-full rounded-xl bg-white pl-10 pr-10 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
                      emailExists ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-[#33e49c]'
                    }`}
                  />
                  {emailExists && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    </div>
                  )}
                </div>
                {emailExists && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    An account with this email already exists.
                    <Link to="/login" className="ml-1 font-medium underline">Sign in instead?</Link>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-800 mb-1.5">
                  Phone Number *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <PhoneIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="phone" name="phone" type="tel" autoComplete="tel" required
                    value={formData.phone} onChange={handleChange}
                    placeholder="Enter your phone number"
                    inputMode="numeric"
                    maxLength={15}
                    pattern="^[0-9]{7,15}$"
                    title="Enter 7 to 15 digits"
                    className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#33e49c] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-1.5">Password *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password" name="password" type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password" required value={formData.password} onChange={handleChange}
                    placeholder="Create a strong password"
                    className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-12 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#33e49c] focus:border-transparent"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {showPassword ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                  </button>
                </div>

                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">Password strength:</span>
                      <span className={`text-xs font-medium ${
                        passwordStrength.score >= 4 ? 'text-green-600'
                        : passwordStrength.score >= 3 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`} style={{ width: `${(passwordStrength.score / 5) * 100}%` }} />
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <p className="mb-1">Password must include:</p>
                        <ul className="space-y-1">
                          {passwordStrength.feedback.map((item, i) => (
                            <li key={i} className="flex items-center">
                              <X className="h-3 w-3 text-red-500 mr-2" /> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-800 mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password" required value={formData.confirmPassword} onChange={handleChange}
                    placeholder="Confirm your password"
                    className={`block w-full rounded-xl bg-white pl-10 pr-12 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
                      formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-[#33e49c]'
                    }`}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {showConfirmPassword ? <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" /> : <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" /> Passwords do not match
                  </p>
                )}
                {formData.confirmPassword && formData.password === formData.confirmPassword && formData.password && (
                  <p className="mt-2 text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" /> Passwords match
                  </p>
                )}
              </div>

              <div className="flex items-start">
                <input
                  id="agreeToTerms" name="agreeToTerms" type="checkbox"
                  checked={formData.agreeToTerms} onChange={handleChange}
                  className="h-4 w-4 text-[#33e49c] focus:ring-[#33e49c] border-gray-300 rounded mt-1"
                />
                <label htmlFor="agreeToTerms" className="ml-3 text-sm text-gray-600">
                  I agree to the{' '}
                  <Link to="/terms" className="text-[#33e49c] hover:text-[#22c98c] font-medium">Terms and Conditions</Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-[#33e49c] hover:text-[#22c98c] font-medium">Privacy Policy</Link>
                </label>
              </div>

              <motion.button
                whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={isLoading || !formData.agreeToTerms || passwordStrength.score < 3}
                className="w-full rounded-xl bg-[#33e49c] text-white font-semibold py-3 shadow-lg shadow-[#33e49c]/20 hover:bg-[#22c98c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#33e49c] disabled:opacity-50"
              >
                {isLoading ? 'Creating account…' : 'Create account'}
              </motion.button>
            </form>

            <div className="mt-5 text-center text-sm text-gray-700">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-[#33e49c] hover:text-[#22c98c]">Sign in</Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Register;
