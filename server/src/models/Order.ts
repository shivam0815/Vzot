// backend/src/models/Order.ts  — COMPLETE FIXED VERSION
import mongoose, { Document, Model, Schema, Types } from "mongoose";

/* ------------------------------------------------------------------ */
/* Types & interfaces                                                  */
/* ------------------------------------------------------------------ */

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "razorpay" | "cod";
export type PaymentStatus =
  | "awaiting_payment"
  | "paid"
  | "failed"
  | "cod_pending"
  | "cod_paid";

export type ShiprocketState =
  | "ORDER_CREATED"
  | "AWB_ASSIGNED"
  | "PICKUP_GENERATED"
  | "LABEL_READY"
  | "INVOICE_READY"
  | "MANIFEST_READY"
  | "TRACKING_UPDATED";

export type ShippingPaymentStatus =
  | "pending"
  | "paid"
  | "partial"      // ✅ keep "partial" (not "partially_paid")
  | "expired"
  | "cancelled";

/* ------------------------------------------------------------------ */
/* GST types                                                           */
/* ------------------------------------------------------------------ */

export interface IGstDetails {
  wantInvoice?: boolean;      // whether customer asked for GST invoice
  gstin?: string;             // 15-char GSTIN
  legalName?: string;         // registered legal name
  placeOfSupply?: string;     // state code or state name
  email?: string;
  requestedAt?: Date;         // auto-set when wantInvoice === true

  // optional accounting fields used by middleware
  taxPercent?: number;
  taxBase?: number;
  taxAmount?: number;
   invoiceNumber?: string;
  invoiceUrl?: string;
}

/* ------------------------------------------------------------------ */
/* Order-related interfaces                                            */
/* ------------------------------------------------------------------ */

export interface IOrderItem {
  productId: Types.ObjectId;
  quantity: number;
  price: number;
  name?: string;
  image?: string;
    sku?: string;
  hsn?: string;          // 6/8 digit HSN
  taxPercent?: number;  
    
}

export interface IAddress {
  fullName: string;
  phoneNumber: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface IShippingPackage {
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  weightKg?: number;
  notes?: string;
  images?: string[];
  packedAt?: Date;
}

export interface IShippingPayment {
  linkId?: string;
  shortUrl?: string;
  status?: ShippingPaymentStatus;
  currency?: string;
  amount?: number;
  amountPaid?: number;
  paymentIds?: string[];
  paidAt?: Date;
}

export interface IOrder extends Document {
  userId: Types.ObjectId;
  orderNumber: string;

  items: IOrderItem[];

  shippingAddress: IAddress;
  billingAddress: IAddress;
 invoiceNumber?: string;
  paymentMethod: PaymentMethod;
  paymentOrderId?: string; // ✅ optional for COD
  paymentId?: string;
  paymentSignature?: string;

  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  discount?: number;

  gst?: IGstDetails;
  hsn:number;
  status: OrderStatus;
  orderStatus: OrderStatus;

  // Tracking
  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
  estimatedDelivery?: Date;

  // Payment status
  paymentStatus: PaymentStatus;
  paidAt?: Date;

  // Lifecycle
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;

  // Notes & refunds
  notes?: string;
  customerNotes?: string;
  refundAmount?: number;
  refundReason?: string;

  // Shiprocket
  shipmentId?: number;
  awbCode?: string;
  courierName?: string;
  labelUrl?: string;
  invoiceUrl?: string;
  manifestUrl?: string;
  shiprocketStatus?: ShiprocketState;

  // NEW
  shippingPackage?: IShippingPackage;
  shippingPayment?: IShippingPayment;
  shiprocketOrderId?: string;
  shiprocketChannelId?: string;
  shiprocketResponse?: any;
  // Auto timestamps
  createdAt: Date;
  updatedAt: Date;

  inventoryCommitted?: boolean;

  // Virtuals
  displayOrderNumber?: string;
  totalItems?: number;
  orderAge?: number;
  isDelivered?: boolean;
  isPaid?: boolean;
  gstStatus?: "none" | "requested" | "ready";
}

/* Instance methods */
export interface IOrderMethods {
  updateStatus(newStatus: OrderStatus, updateDate?: boolean): Promise<IOrder>;
  updatePaymentStatus(newPaymentStatus: PaymentStatus): Promise<IOrder>;

  attachShiprocketOrder(shipmentId: number): Promise<IOrder>;
  setAwb(opts: { awbCode: string; courierName?: string }): Promise<IOrder>;
  markPickupGenerated(): Promise<IOrder>;
  setLabelUrl(url: string): Promise<IOrder>;
  setInvoiceUrl(url: string): Promise<IOrder>;
  setManifestUrl(url: string): Promise<IOrder>;
  updateTrackingFromAwb(opts: {
    awbCode?: string;
    carrierName?: string;
    trackingUrl?: string;
    estimatedDelivery?: Date | string;
  }): Promise<IOrder>;
}

/* Static methods */
export interface IOrderModel extends Model<IOrder, {}, IOrderMethods> {
  findByOrderNumber(orderNumber: string): Promise<IOrder | null>;
  findByTrackingNumber(trackingNumber: string): Promise<IOrder | null>;
  getUserOrders(userId: string, limit?: number): Promise<IOrder[]>;
}

/* ------------------------------------------------------------------ */
/* Sub-schemas                                                         */
/* ------------------------------------------------------------------ */

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    name: { type: String },
    image: { type: String },
    sku: { type: String, trim: true },
    hsn: { type: String, trim: true },          // no regex here; SR accepts 6/8 digits
    taxPercent: { type: Number, min: 0 },  

  },
  { _id: false }
);

const AddressSchema = new Schema<IAddress>(
  {
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
  },
  { _id: false }
);

// Simplified but strict GSTIN validation + normalization
const GSTIN_REGEX =
  /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;

const GstSchema = new Schema<IGstDetails>(
  {
    wantInvoice: { type: Boolean, default: false },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function (this: IGstDetails, v?: string) {
          if (!this.wantInvoice) return true; // ignore if not requested
          if (!v) return false;               // requested → must have GSTIN
          return GSTIN_REGEX.test(v);
        },
        message: "Invalid GSTIN format",
      },
    },
    legalName: {
      type: String,
      trim: true,
      set: (v: string) => (v ? v.trim() : v),
    },
    placeOfSupply: {
      type: String,
      trim: true,
      set: (v: string) => (v ? v.trim().toUpperCase() : v),
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    requestedAt: { type: Date },

    // optional computed tax info
    taxPercent: { type: Number, min: 0 },
    taxBase: { type: Number, min: 0 },
    taxAmount: { type: Number, min: 0 },
      invoiceNumber: { type: String, trim: true },
    invoiceUrl: { type: String, trim: true },
  },
  { _id: false }
);

/* ------------------------------------------------------------------ */
/* Order schema                                                        */
/* ------------------------------------------------------------------ */

const OrderSchema = new Schema<IOrder, IOrderModel, IOrderMethods>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    orderNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },

    items: { type: [OrderItemSchema], required: true },

    shippingAddress: { type: AddressSchema, required: true },
    billingAddress: { type: AddressSchema, required: true },

    paymentMethod: { type: String, enum: ["razorpay", "cod"], required: true },

    // ✅ Optional when COD
    paymentOrderId: {
      type: String,
      trim: true,
      required: function (this: IOrder) {
        return this.paymentMethod === "razorpay";
      },
    },
    paymentId: { type: String, trim: true },
    paymentSignature: { type: String, trim: true },

    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0, immutable: true },

    total: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, default: 0 },

    // GST stored here
    gst: { type: GstSchema, required: false, default: undefined },

    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    trackingNumber: { type: String, trim: true, uppercase: true },
    trackingUrl: { type: String, trim: true },
    carrierName: { type: String, trim: true },
    estimatedDelivery: { type: Date },

    paymentStatus: {
      type: String,
      enum: ["awaiting_payment", "paid", "failed", "cod_pending", "cod_paid"],
      default: "awaiting_payment",
    },
    paidAt: { type: Date },

    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },

    notes: { type: String, trim: true },
    customerNotes: { type: String, trim: true },
    refundAmount: { type: Number, min: 0, default: 0 },
    refundReason: { type: String, trim: true },

    // Shiprocket integration
    shipmentId: { type: Number, index: true },
    awbCode: { type: String, trim: true, uppercase: true, index: true },
    courierName: { type: String, trim: true },
    
    labelUrl: { type: String, trim: true },
    invoiceUrl: { type: String, trim: true },
      invoiceNumber:{ type: String, trim: true }, 
    manifestUrl: { type: String, trim: true },
    shiprocketStatus: {
      type: String,
      enum: [
        "ORDER_CREATED",
        "AWB_ASSIGNED",
        "PICKUP_GENERATED",
        "LABEL_READY",
        "INVOICE_READY",
        "MANIFEST_READY",
        "TRACKING_UPDATED",
      ],
    },
    // Shiprocket order identifiers
shiprocketOrderId:   { type: String, index: true },
shiprocketChannelId: { type: String },
shiprocketResponse:  { type: Schema.Types.Mixed },

    // Package & shipping payment
    shippingPackage: {
      lengthCm: { type: Number, min: 0 },
      breadthCm: { type: Number, min: 0 },
      heightCm: { type: Number, min: 0 },
      weightKg: { type: Number, min: 0 },
      notes: { type: String, trim: true },
      images: {
        type: [String],
        validate: {
          validator: (arr: string[]) => !arr || arr.length <= 5,
          message: "Max 5 images allowed",
        },
        default: [],
      },
      packedAt: { type: Date },
    },

    shippingPayment: {
      linkId: { type: String, index: true },
      shortUrl: { type: String },
      status: {
        type: String,
        enum: ["pending", "paid", "partial", "expired", "cancelled"], // ✅ keep "partial"
        default: "pending",
      },
      currency: { type: String, default: "INR" },
      amount: { type: Number, min: 0 },
      amountPaid: { type: Number, min: 0 },
      paymentIds: { type: [String], default: [] },
      paidAt: { type: Date },
    },

    inventoryCommitted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ------------------------------------------------------------------ */
/* Virtuals                                                            */
/* ------------------------------------------------------------------ */

OrderSchema.virtual("displayOrderNumber").get(function (this: IOrder) {
  return this.orderNumber || `ORD-${this.id.toString().slice(-8).toUpperCase()}`;
});

OrderSchema.virtual("totalItems").get(function (this: IOrder) {
  return (this.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
});

OrderSchema.virtual("orderAge").get(function (this: IOrder) {
  const now = Date.now();
  const created = new Date(this.createdAt).getTime();
  return Math.ceil(Math.abs(now - created) / (1000 * 60 * 60 * 24));
});

OrderSchema.virtual("isDelivered").get(function (this: IOrder) {
  return this.status === "delivered" || this.orderStatus === "delivered";
});

OrderSchema.virtual("isPaid").get(function (this: IOrder) {
  return this.paymentStatus === "paid" || this.paymentStatus === "cod_paid";
});

// ✅ Helpful for Admin badge/chip
OrderSchema.virtual("gstStatus").get(function (this: IOrder) {
  const g = this.gst;
  if (!g || !g.wantInvoice) return "none";
  return g.gstin ? "ready" : "requested";
});

/* ------------------------------------------------------------------ */
/* Indexes                                                             */
/* ------------------------------------------------------------------ */

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 }, { unique: true });
OrderSchema.index({ paymentOrderId: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ trackingNumber: 1 });
OrderSchema.index({ "shippingAddress.pincode": 1 });
OrderSchema.index({ "shippingAddress.city": 1 });
OrderSchema.index({ paymentMethod: 1, createdAt: -1 });
OrderSchema.index({ total: -1 });
OrderSchema.index({ "gst.gstin": 1 });
OrderSchema.index({ "gst.wantInvoice": 1, createdAt: -1 }); // ✅ fast filter for admin GST list
OrderSchema.index({ shipmentId: 1 });
OrderSchema.index({ awbCode: 1 });
OrderSchema.index({ "shippingPayment.linkId": 1 });

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */

// Normalize + auto-stamp GST request, compute tax if configured
OrderSchema.pre<IOrder>("validate", function (next) {
  if (this.gst) {
    // Normalize casing
    if (typeof this.gst.gstin === "string") this.gst.gstin = this.gst.gstin.trim().toUpperCase();
    if (typeof this.gst.legalName === "string") this.gst.legalName = this.gst.legalName.trim();
    if (typeof this.gst.placeOfSupply === "string")
      this.gst.placeOfSupply = this.gst.placeOfSupply.trim().toUpperCase();
    if (typeof this.gst.email === "string") this.gst.email = this.gst.email.trim().toLowerCase();

    // Auto-flag request time
    if (this.gst.wantInvoice && !this.gst.requestedAt) {
      this.gst.requestedAt = new Date();
    }

    // If not requested, clear sensitive fields to avoid stale data
    if (!this.gst.wantInvoice) {
      this.gst.gstin = undefined;
      this.gst.legalName = undefined;
      this.gst.placeOfSupply = undefined;
      this.gst.email = undefined;
      this.gst.requestedAt = undefined;
      this.gst.taxPercent = undefined;
      this.gst.taxBase = undefined;
      this.gst.taxAmount = undefined;
    }
  }
  next();
});

OrderSchema.pre<IOrder>("save", function (next) {
  // ── Helpers ──────────────────────────────────────────────────────────────
  const isAddressEmpty = (addr: Partial<IAddress> | undefined | null) => {
    if (!addr) return true;
    // consider it empty if all key fields are missing/blank
    const requiredKeys: (keyof IAddress)[] = [
      "fullName",
      "phoneNumber",
      "email",
      "addressLine1",
      "city",
      "state",
      "pincode",
    ];
    return requiredKeys.every((k) => {
      const v = (addr as any)[k];
      return v == null || String(v).trim() === "";
    });
  };

  const clonePlain = <T extends object>(obj: T | undefined): T | undefined => {
    if (!obj) return undefined;
    // if it's a mongoose subdoc, toObject() exists
    const anyObj = obj as any;
    if (typeof anyObj.toObject === "function") return anyObj.toObject();
    return { ...(obj as any) };
  };

  // ── Billing fallback (fixes: object-by-reference comparison) ─────────────
  if (isAddressEmpty(this.billingAddress)) {
    const ship = clonePlain(this.shippingAddress);
    if (ship) this.billingAddress = ship as IAddress;
  }

  // Optional computed tax: only if taxPercent provided and tax not already set
  if (this.gst?.wantInvoice && this.gst.taxPercent != null && (!this.tax || this.tax === 0)) {
    const base = Math.max(0, (this.subtotal || 0) - (this.discount || 0));
    const amt = +(base * (Number(this.gst.taxPercent) / 100)).toFixed(2);
    this.tax = amt;
    this.gst.taxBase = base;
    this.gst.taxAmount = amt;
  }

  // orderNumber generation only if missing (rare)
  if (!this.orderNumber) {
    const ts = Date.now();
    const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    this.orderNumber = `ORD${ts}${rnd}`.toUpperCase();
  }

  this.updatedAt = new Date();
  if (this.isNew) this.createdAt = new Date();
  next();
});


/* ------------------------------------------------------------------ */
/* Instance methods                                                    */
/* ------------------------------------------------------------------ */

OrderSchema.methods.updateStatus = function (
  this: IOrder,
  newStatus: OrderStatus,
  updateDate: boolean = true
) {
  this.status = newStatus;
  this.orderStatus = newStatus;

  if (updateDate) {
    const now = new Date();
    switch (newStatus) {
      case "shipped":
        this.shippedAt = now;
        break;
      case "delivered":
        this.deliveredAt = now;
        break;
      case "cancelled":
        this.cancelledAt = now;
        break;
    }
  }

  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.updatePaymentStatus = function (this: IOrder, newPaymentStatus: PaymentStatus) {
  this.paymentStatus = newPaymentStatus;

  if (newPaymentStatus === "paid" || newPaymentStatus === "cod_paid") {
    this.paidAt = new Date();
    if (this.status === "pending") {
      this.status = "processing";
      this.orderStatus = "processing";
    }
  }

  this.updatedAt = new Date();
  return this.save();
};

// Shiprocket helpers
OrderSchema.methods.attachShiprocketOrder = function (this: IOrder, shipmentId: number) {
  this.shipmentId = shipmentId;
  this.shiprocketStatus = "ORDER_CREATED";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.setAwb = function (this: IOrder, opts: { awbCode: string; courierName?: string }) {
  this.awbCode = (opts.awbCode || "").toUpperCase();
  if (opts.courierName) this.courierName = opts.courierName;
  this.trackingNumber = this.awbCode;
  this.shiprocketStatus = "AWB_ASSIGNED";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.markPickupGenerated = function (this: IOrder) {
  this.shiprocketStatus = "PICKUP_GENERATED";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.setLabelUrl = function (this: IOrder, url: string) {
  this.labelUrl = url;
  this.shiprocketStatus = "LABEL_READY";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.setInvoiceUrl = function (this: IOrder, url: string) {
  this.invoiceUrl = url;
  this.shiprocketStatus = "INVOICE_READY";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.setManifestUrl = function (this: IOrder, url: string) {
  this.manifestUrl = url;
  this.shiprocketStatus = "MANIFEST_READY";
  this.updatedAt = new Date();
  return this.save();
};

OrderSchema.methods.updateTrackingFromAwb = function (
  this: IOrder,
  opts: { awbCode?: string; carrierName?: string; trackingUrl?: string; estimatedDelivery?: Date | string }
) {
  if (opts.awbCode) this.awbCode = String(opts.awbCode).toUpperCase();
  if (opts.carrierName) this.courierName = opts.carrierName;
  if (opts.trackingUrl) this.trackingUrl = opts.trackingUrl;
  if (opts.estimatedDelivery) this.estimatedDelivery = new Date(opts.estimatedDelivery);
  this.shiprocketStatus = "TRACKING_UPDATED";
  this.updatedAt = new Date();
  return this.save();
};

/* ------------------------------------------------------------------ */
/* Statics                                                             */
/* ------------------------------------------------------------------ */

OrderSchema.statics.findByOrderNumber = function (this: IOrderModel, orderNumber: string) {
  return this.findOne({ orderNumber: orderNumber.toUpperCase() });
};

OrderSchema.statics.findByTrackingNumber = function (this: IOrderModel, trackingNumber: string) {
  return this.findOne({ trackingNumber: trackingNumber.toUpperCase() });
};

OrderSchema.statics.getUserOrders = function (this: IOrderModel, userId: string, limit: number = 20) {
  return this.find({ userId }).sort({ createdAt: -1 }).limit(limit).populate("items.productId");
};

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */
// ---- prevent accidental overwrite of shipping ----
function stripShippingFromUpdate(this: any) {
  const u = this.getUpdate?.() || {};
  if (u.$set && 'shipping' in u.$set) delete u.$set.shipping;
  if ('shipping' in u) delete u.shipping;
}
OrderSchema.pre('updateOne', stripShippingFromUpdate);
OrderSchema.pre('findOneAndUpdate', stripShippingFromUpdate);
OrderSchema.pre('updateMany', stripShippingFromUpdate);

const Order =
  (mongoose.models.Order as IOrderModel) ||
  mongoose.model<IOrder, IOrderModel>("Order", OrderSchema);
export default Order;
