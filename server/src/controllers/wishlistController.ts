import { Request, Response } from 'express';
import Wishlist from '../models/Wishlist';
import Product from '../models/Product';

// Define the interface locally
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    name: string;
    isVerified: boolean;
    twoFactorEnabled: boolean;
  };
}

export const getWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const wishlist = await Wishlist.findOne({ userId })
      .populate('items.productId')
      .lean();

    if (!wishlist) {
      res.json({ success: true, wishlist: { items: [] } });
      return;
    }

    // Transform the data structure to match frontend expectations
    const formattedItems = wishlist.items
      .filter(item => item.productId)
      .map(item => ({
        productId: item.productId._id || item.productId.id,
        product: item.productId,
        addedAt: item.addedAt
      }))
      .filter(item => item.product && (item.product as any).isActive);

    res.json({
      success: true,
      wishlist: { items: formattedItems }
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addToWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.body;
    const userId = (req as AuthenticatedRequest).user?.id;

    if (!userId || !productId) {
      res.status(400).json({ message: 'User ID and Product ID required' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, items: [] });
    }

    const existingItem = wishlist.items.find(
      item => item.productId.toString() === productId
    );

    if (existingItem) {
      res.status(409).json({ message: 'Item already in wishlist' });
      return;
    }

    wishlist.items.push({ productId, addedAt: new Date() });
    await wishlist.save();

    await wishlist.populate('items.productId');
    
    const formattedItems = wishlist.items
      .filter(item => item.productId)
      .map(item => ({
        productId: item.productId._id || item.productId.id,
        product: item.productId,
        addedAt: item.addedAt
      }));

    res.status(201).json({
      success: true,
      message: 'Added to wishlist',
      wishlist: { items: formattedItems }
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const removeFromWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const userId = (req as AuthenticatedRequest).user?.id;

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      res.status(404).json({ message: 'Wishlist not found' });
      return;
    }

    wishlist.items = wishlist.items.filter(
      item => item.productId.toString() !== productId
    );

    await wishlist.save();
    await wishlist.populate('items.productId');

    const formattedItems = wishlist.items
      .filter(item => item.productId)
      .map(item => ({
        productId: item.productId._id || item.productId.id,
        product: item.productId,
        addedAt: item.addedAt
      }));

    res.json({
      success: true,
      message: 'Removed from wishlist',
      wishlist: { items: formattedItems }
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ ENSURE THIS FUNCTION EXISTS AND IS EXPORTED
export const clearWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id;
    
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    await Wishlist.findOneAndDelete({ userId });
    
    res.json({
      success: true,
      message: 'Wishlist cleared'
    });
  } catch (error) {
    console.error('Clear wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
