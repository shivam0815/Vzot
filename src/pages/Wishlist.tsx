import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, ShoppingCart, Trash2, Share2, Filter, Grid, List, ArrowLeft } from "lucide-react";
import { useWishlistContext } from "../context/WishlistContext";
import { useCartContext } from "../context/CartContext";
import toast from "react-hot-toast";
import VZOTBackground from '../components/Layout/VZOTBackground';

const Wishlist: React.FC = () => {
  const { items, removeFromWishlist, clearWishlist, isLoading, getTotalItems, refreshWishlist } =
    useWishlistContext();
  const { addToCart } = useCartContext();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("name");
  const [filterCategory, setFilterCategory] = useState("");

  useEffect(() => {
    refreshWishlist(true);
  }, [refreshWishlist]);

  const handleMoveToCart = async (product: any) => {
    try {
      await addToCart(product.id);
      await removeFromWishlist(product.id);
      toast.success("Moved to cart successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to move to cart");
    }
  };

  const shareWishlist = () => {
    if (navigator.share) {
      navigator.share({
        title: "My Wishlist",
        text: "Check out my wishlist!",
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Wishlist link copied!");
    }
  };

  const filteredAndSortedItems = items
    .filter((i) => !filterCategory || i.category === filterCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case "price-low":
          return a.price - b.price;
        case "price-high":
          return b.price - a.price;
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const categories = [...new Set(items.map((i) => i.category))];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading wishlist...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        
        <div className="text-center">
          <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Your wishlist is empty</h2>
          <Link to="/products" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded">
            Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
       
      <VZOTBackground />
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link to="/products" className="mr-4 p-2 text-gray-600 hover:text-gray-800">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">My Wishlist</h1>
            <p className="text-gray-600 mt-1">
              {getTotalItems()} {getTotalItems() === 1 ? "item" : "items"} saved
            </p>
          </div>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={shareWishlist}
            className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center space-x-2"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
          <button
            onClick={clearWishlist}
            className="px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
          >
            Clear All
          </button>
        </div>
      </div>
{/* Items */}
      {/* Items */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredAndSortedItems.map((item, idx) => (
            <motion.div
              key={item.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded shadow p-4"
            >
              <img src={item.image} alt={item.name} className="w-full h-48 object-cover mb-4" />
              <h3 className="font-medium truncate text-gray-900 dark:text-black">
  {item.name}
</h3>


              <p className="text-blue-600 font-bold">₹{item.price.toLocaleString()}</p>
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => handleMoveToCart(item)}
                  className="flex-1 bg-blue-600 text-white py-2 rounded"
                >
                  Move to Cart
                </button>
                <button
                  onClick={() => removeFromWishlist(item.id)}
                  className="p-2 border rounded hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedItems.map((item, idx) => (
            <motion.div
              key={item.id || idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center bg-white rounded shadow p-4"
            >
              <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded mr-4" />
              <div className="flex-1">
                <h3 className="font-medium">{item.name}</h3>
                <p className="text-blue-600 font-bold">₹{item.price.toLocaleString()}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleMoveToCart(item)}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Add to Cart
                </button>
                <button
                  onClick={() => removeFromWishlist(item.id)}
                  className="border px-4 py-2 rounded hover:bg-red-50 text-red-600"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
