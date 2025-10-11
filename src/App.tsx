// src/App.tsx
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Scrolltop from './components/Layout/Scrolltop';
// import


// inside <Routes>
<Route path="/order-success" element={<OrderSuccess />} />


import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import ChatBot from './components/Layout/Chatbot';

import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Cart from './pages/Cart';
import OEM from './pages/OEM';

import Contact from './pages/Contact';
import Wishlist from './pages/Wishlist';
import Profile from './pages/Profile';
import Checkout from './pages/Checkout';
import LoginSuccess from './pages/LoginSuccess';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './components/Layout/ResetPassword';
import VerifyEmailSent from './components/Layout/VerifyEmailSent';
import ForgotPassword from './components/Layout/ForgotPassword';
import ProfessionalAuthWrapper from './pages/ProfessionalAuthWrapper';
import OrderSuccess from './pages/OrderSuccess';
import OrderDetails from './pages/OrderDetails';
import Search from './pages/SearchResults';
import CategoriesPage from './pages/category';
import NewsletterConfirm from './pages/NewsletterConfirm';
import NewsletterUnsubscribe from './pages/NewsletterUnsubscribe';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Video from "./pages/Video";


// ✅ Use the auth context directly; no new files are added
import { useAuth } from './context/AuthContext';

const PublicLayout = ({ children }: { children: React.ReactNode }) => (
  <>
    <Header />
    <main className="flex-1">{children}</main>
    <Footer />
  </>
);

/** Param-preserving redirect: /product/:id -> /products/:id */
function LegacyProductRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/products/${id}` : '/products'} replace />;
}

/** 🔒 Inline-guarded Profile route (no separate file). */
function GuardedProfileRoute() {
  const { isAuthenticated, isBootstrapped, isLoading } = useAuth();
  const location = useLocation();

  // Prevent flicker while initial auth check runs
  if (!isBootstrapped || isLoading) return null; // or a tiny spinner

  return isAuthenticated
    ? <PublicLayout><Profile /></PublicLayout>
    : <Navigate to="/login" replace state={{ from: location }} />;
}

function App() {
  return (
    <Router>
      <Scrolltop />
      <div className="min-h-screen flex flex-col">
        <Routes>
          {/* ADMIN */}
          <Route path="/admin/*" element={<ProfessionalAuthWrapper />} />

          {/* PUBLIC */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
  <Route path="/video" element={<Video />} />

          {/* Products listing + detail */}
          <Route path="/products" element={<PublicLayout><Products /></PublicLayout>} />
          <Route path="/products/:id" element={<PublicLayout><ProductDetail /></PublicLayout>} />

          {/* Legacy route redirect */}
          <Route path="/product/:id" element={<LegacyProductRedirect />} />

          {/* Categories */}
          <Route path="/categories" element={<PublicLayout><CategoriesPage /></PublicLayout>} />

          {/* Auth & profile */}
          <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />

          {/* 🔒 Profile guarded inline (fixes “still on profile after logout” without new files) */}
          <Route path="/profile" element={<GuardedProfileRoute />} />

          {/* ✅ Leading slash so /login-success always matches */}
          <Route path="/login-success" element={<LoginSuccess />} />

          {/* Commerce */}
          <Route path="/cart" element={<PublicLayout><Cart /></PublicLayout>} />
          <Route path="/checkout" element={<PublicLayout><Checkout /></PublicLayout>} />
          <Route path="/order-success/:orderId" element={<PublicLayout><OrderSuccess /></PublicLayout>} />
          <Route path="/order-details/:orderId" element={<PublicLayout><OrderDetails /></PublicLayout>} />

          {/* Info pages */}
          <Route path="/oem" element={<PublicLayout><OEM /></PublicLayout>} />
          
          <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />

          {/* Wishlist */}
          <Route path="/wishlist" element={<PublicLayout><Wishlist /></PublicLayout>} />

          {/* Email + password flows */}
          <Route path="/verify-email/:token" element={<PublicLayout><VerifyEmail /></PublicLayout>} />
          <Route path="/verify-email-sent" element={<PublicLayout><VerifyEmailSent /></PublicLayout>} />
          <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
          <Route path="/reset-password-otp" element={<PublicLayout><ResetPassword /></PublicLayout>} />
          <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout >} />
          <Route path="/newsletter/confirm" element={<PublicLayout><NewsletterConfirm /></PublicLayout>} />
          <Route path="/newsletter/unsubscribe" element={<PublicLayout><NewsletterUnsubscribe /></PublicLayout>} />

          {/* Blog */}
          <Route path="/blog" element={<PublicLayout><Blog /></PublicLayout>} />
          <Route path="/blog/:slug" element={<PublicLayout><BlogPost /></PublicLayout>} />

          {/* Legal */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/order-success" element={<OrderSuccess />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global widgets */}
        <div className="App">
          <ChatBot />
        </div>
        <Toaster position="top-right" />
        <ToastContainer />
      </div>
    </Router>
  );
}

export default App;
