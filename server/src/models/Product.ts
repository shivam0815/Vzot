// src/models/Product.ts (B2C)
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  // core
  name: string;
  slug?: string;                 // NEW: for pretty URLs and lookups
  description: string;
  price: number;
  originalPrice?: number;
  compareAtPrice?: number | null;
  category: string;
  subcategory?: string;
  brand: string;
  images: string[];
  imageUrl?: string;             // NEW: single primary image path/url (S3/Cloudinary)
  // ratings
  rating: number;
  reviews: number;
  averageRating?: number;
  ratingsCount?: number;
  // stock
  inStock: boolean;
  stockQuantity: number;
  reservedQty: { type: Number, required: true, min: 0, default: 0 }, // NEW

  // content
  features: string[];
  specifications: Map<string, any> | Record<string, any>;
  tags: string[];
  // status
  isActive: boolean;
  status: 'active' | 'inactive' | 'draft';
  businessName?: string;
  createdAt: Date;
  updatedAt: Date;

  // optional product details
  sku?: string;
  color?: string;
  ports?: number;
  warrantyPeriodMonths?: number;
  warrantyType?: 'Manufacturer' | 'Seller' | 'No Warranty';
  manufacturingDetails?: Record<string, any>;

  // admin-only (kept hidden)
  gst?: number;
  hsnCode?: string;
  netWeight?: number;

  // NEW: signals used for Home sections
  salesCount7d?: number;         // recomputed daily/weekly from orders
  views7d?: number;              // optionally tracked on PDP views
  isTrending?: boolean;          // manual override
  isPopular?: boolean;           // manual override

  // virtuals
  discountPercent?: number;
  isHotDeal?: boolean;
  primaryImage?: string;

    metaTitle?: string;        // <= 60 chars recommended
  metaDescription?: string;  // <= 160 chars recommended

}

interface IProductModel extends Model<IProduct> {
  getSortedFor(params: {
    sort?: 'new' | 'popular' | 'trending';
    limit?: number;
    status?: 'active' | 'inactive' | 'draft';
  }): Promise<IProduct[]>;
}

const productSchema = new Schema<IProduct, IProductModel>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [300, 'Product name cannot exceed 300 characters'],
    },
    slug: { type: String, trim: true, index: true, unique: false }, // unique optional; you might use per-brand
    description: {
      type: String,
      required: [true, 'Product description is required'],
      maxlength: [1500, 'Description cannot exceed 1500 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    originalPrice: { type: Number, min: [0, 'Original price cannot be negative'] },
    compareAtPrice: { type: Number, default: null },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'TWS',
          'Bluetooth Neckbands',
          'Data Cables',
          'Mobile Chargers',
          'Integrated Circuits & Chips',
          'Mobile Repairing Tools',
          'Electronics',
          'Accessories',
          'Car Chargers',
          'Bluetooth Speakers',
          'Power Banks',
          'Others',
          'ICs',
          'Mobile Accessories',
          'Mobile ICs'
        ],
        message: '{VALUE} is not a valid category',
      },
    },
    subcategory: String,
    brand: { type: String, required: [true, 'Brand is required'], default: 'Nakoda' },

    images: { type: [String], default: [] },
    imageUrl: { type: String, trim: true }, // NEW

    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviews: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },

    inStock: { type: Boolean, default: true },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0,
    },

    features: { type: [String], default: [] },
    specifications: { type: Map, of: Schema.Types.Mixed, default: {} },

    tags: { type: [String], default: [] },
     metaTitle:       { type: String, trim: true, maxlength: 160 },
    metaDescription: { type: String, trim: true, maxlength: 160 },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active' },
    businessName: String,

    // optional details
    sku: { type: String, trim: true, index: true },
    color: { type: String, trim: true },
    ports: { type: Number, min: 0, default: 0 },
    warrantyPeriodMonths: { type: Number, min: 0, default: 0 },
    warrantyType: { type: String, enum: ['Manufacturer', 'Seller', 'No Warranty'], default: 'No Warranty' },
    manufacturingDetails: { type: Schema.Types.Mixed, default: {} },

    // admin-only
    gst: { type: Number, min: 0, max: 100, select: false },
    hsnCode: { type: String, trim: true, select: false },
    netWeight: { type: Number, min: 0, select: false },

    // NEW: signals/statistics
    salesCount7d: { type: Number, default: 0, index: true },
    views7d: { type: Number, default: 0 },
    isTrending: { type: Boolean, default: false, index: true },
    isPopular: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        if (ret.specifications instanceof Map) {
          ret.specifications = Object.fromEntries(ret.specifications);
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        if (ret.specifications instanceof Map) {
          ret.specifications = Object.fromEntries(ret.specifications);
        }
        return ret;
      },
    },
  }
);

/** ───────────────────────── Virtuals ───────────────────────── */

productSchema.virtual('discountPercent').get(function (this: IProduct) {
  const cmp = (this.originalPrice ?? this.compareAtPrice ?? 0) as number;
  if (!cmp || !this.price || cmp <= this.price) return 0;
  return Math.round(((cmp - this.price) / cmp) * 100);
});

productSchema.virtual('isHotDeal').get(function (this: IProduct) {
  return (this.discountPercent ?? 0) >= 15; // same threshold as client
});

productSchema.virtual('primaryImage').get(function (this: IProduct) {
  return this.imageUrl && this.imageUrl.length > 0
    ? this.imageUrl
    : (this.images?.[0] ?? '');
});

/** ───────────────────────── Indexes ───────────────────────── */

// Search
productSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text', brand: 'text' });

// Sort/useful
productSchema.index({ category: 1, price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isActive: 1, inStock: 1, status: 1 });
productSchema.index({ _id: 1, stockQuantity: 1 }); // for $inc with $gte check


// For popular/trending lists
productSchema.index({ salesCount7d: -1, rating: -1 });
productSchema.index({ isTrending: -1, views7d: -1, rating: -1 });

/** keep inStock in sync */
productSchema.pre('save', function (next) {
  // @ts-ignore
  this.inStock = (this.stockQuantity || 0) > 0;
  next();
});

/** optional: ensure slug defaults from name if not provided */
productSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = String(this.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 120);
  }
  next();
});
productSchema.post('findOneAndUpdate', function(doc: any) {
  if (!doc) return;
  const inStock = (doc.stockQuantity || 0) > 0;
  if (doc.inStock !== inStock) doc.updateOne({ $set: { inStock } }).exec();
});

/** ───────────────────────── Statics (helper for controller) ───────────────────────── */

productSchema.statics.getSortedFor = function ({
  sort = 'new',
  limit = 24,
  status = 'active',
}: {
  sort?: 'new' | 'popular' | 'trending';
  limit?: number;
  status?: 'active' | 'inactive' | 'draft';
}) {
  const q: any = {};
  if (status) q.status = status;
  q.isActive = true;
  q.inStock = { $ne: false }; // allow 0 qty to be filtered at UI if you prefer

  let cursor = this.find(q);

  if (sort === 'new') {
    cursor = cursor.sort({ createdAt: -1 });
  } else if (sort === 'popular') {
    // manual isPopular first; then weekly sales; then rating
    cursor = cursor.sort({ isPopular: -1, salesCount7d: -1, rating: -1, createdAt: -1 });
  } else if (sort === 'trending') {
    // manual isTrending first; then views/sales; then rating
    cursor = cursor.sort({ isTrending: -1, salesCount7d: -1, views7d: -1, rating: -1, createdAt: -1 });
  } else {
    cursor = cursor.sort({ createdAt: -1 });
  }

  return cursor.limit(Number(limit)).lean();
};

const Product = mongoose.model<IProduct, IProductModel>('Product', productSchema);
export default Product;
