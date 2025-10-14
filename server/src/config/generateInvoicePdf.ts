// src/utils/invoice/generateInvoicePdf.ts
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import dayjs from "dayjs";

/* -------- Types kept loose to avoid tight coupling -------- */
export type InvoiceParty = {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;          // optional for buyer
  placeOfSupply?: string;  // buyer state if GST invoice
};

export type InvoiceItem = {
  name: string;
  quantity: number;
  price: number;        // unit price (tax-exclusive or inclusive? we’ll treat subtotal/tax from order)
  hsn?: string;         // optional HSN/SAC
  sku?: string;         // optional
  image?: string;       // unused in PDF table
};

export type InvoiceGST = {
  wantInvoice?: boolean;
  gstin?: string;       // buyer GSTIN (if any)
  legalName?: string;
  placeOfSupply?: string;
  taxPercent?: number;  // e.g. 18
  taxBase?: number;     // taxable value
  taxAmount?: number;   // total GST
  email?: string;
};

export type InvoiceOrder = {
  _id: any;
  orderNumber?: string;
  invoiceNumber?: string;
  createdAt?: string | Date;
  items: InvoiceItem[];
  subtotal: number;   // pre-tax
  shipping?: number;
  tax: number;        // total GST
  total: number;      // grand total
  paymentMethod?: string; // "cod" | "razorpay" | etc.
  shippingAddress: InvoiceParty;
  billingAddress?: InvoiceParty;
  gst?: InvoiceGST;
};

/* -------- Helpers -------- */
const INRC = (n: number) =>
  `₹${Math.max(0, Math.round(n)).toLocaleString("en-IN")}`;

const safe = (s?: any) => (s ?? "").toString().trim();

const addrLines = (p?: InvoiceParty) => {
  if (!p) return [];
  const lines: string[] = [];
  const a1 = safe(p.addressLine1);
  const a2 = safe(p.addressLine2);
  const city = [safe(p.city), safe(p.state), safe(p.pincode)].filter(Boolean).join(", ");
  if (a1) lines.push(a1);
  if (a2) lines.push(a2);
  if (city) lines.push(city);
  return lines;
};

function headerCell(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number) {
  doc
    .rect(x, y, w, 20)
    .fill("#F3F4F6")
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(text, x + 6, y + 6, { width: w - 12, align: "left" })
    .fillColor("black")
    .font("Helvetica");
}

function tableCell(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number) {
  doc
    .rect(x, y, w, 20)
    .strokeColor("#E5E7EB")
    .stroke()
    .fillColor("#111827")
    .fontSize(10)
    .text(text, x + 6, y + 6, { width: w - 12, align: "left" })
    .fillColor("black");
}

/* -------- Core render -------- */
function render(doc: PDFKit.PDFDocument, order: InvoiceOrder, seller: {
  name: string;
  addressLines: string[];
  gstin?: string;
  cin?: string;
  supportEmail?: string;
  supportPhone?: string;
}) {
  const created = order.createdAt ? dayjs(order.createdAt) : dayjs();
  const invNo =
    safe(order.invoiceNumber) ||
    `INV-${safe(order.orderNumber) || String(order._id).slice(-6)}-${created.format("YYYYMMDD")}`;

  // Margins and layout
  const M = 36;
  doc.info.Title = `Tax Invoice ${invNo}`;
  doc.info.Author = seller.name;

  /* Top brand block */
/* Top brand block with logo */
const logoUrl = "https://nakoda-com-image.s3.ap-south-1.amazonaws.com/products/apple-touch-icon.png";

try {
  // Draw logo (width auto, height 50)
  const logoHeight = 50;
  doc.image(logoUrl, M, M, { fit: [100, logoHeight] });
  doc.font("Helvetica-Bold").fontSize(16).text(seller.name, M + 120, M + 10);
} catch {
  // Fallback if image fails to load
  doc.font("Helvetica-Bold").fontSize(16).text(seller.name, M, M);
}

  doc.font("Helvetica").fontSize(9);
  const baseY = M + 60; // start text below logo
seller.addressLines.forEach((ln, i) => doc.text(ln, M, baseY + i * 12));
let metaY = baseY + seller.addressLines.length * 12 + 6;


  if (seller.gstin) doc.text(`Seller GSTIN: ${seller.gstin}`, M, metaY), (metaY += 12);
  if (seller.cin)   doc.text(`CIN: ${seller.cin}`, M, metaY), (metaY += 12);
  if (seller.supportEmail || seller.supportPhone) {
    doc.text(
      `Support: ${[seller.supportEmail, seller.supportPhone].filter(Boolean).join(" · ")}`,
      M,
      metaY
    );
  }

  /* Invoice meta */
  const rightX = 360;
  doc.font("Helvetica-Bold").fontSize(14).text("TAX INVOICE", rightX, M);
  doc.font("Helvetica").fontSize(10);
  doc.text(`Invoice No: ${invNo}`, rightX, M + 22);
  doc.text(`Order No: ${safe(order.orderNumber) || String(order._id)}`, rightX, M + 36);
  doc.text(`Invoice Date: ${created.format("DD MMM YYYY")}`, rightX, M + 50);
  if (order.paymentMethod) doc.text(`Payment: ${order.paymentMethod.toUpperCase()}`, rightX, M + 64);

  /* Bill To / Ship To */
  const boxTop = metaY + 30;
  const colW = 260;

  doc.font("Helvetica-Bold").fontSize(11).text("Bill To", M, boxTop);
  doc.font("Helvetica").fontSize(10);
  const bill = order.billingAddress || order.shippingAddress;
  doc.text(safe(bill?.fullName || bill?.email), M, boxTop + 16);
  addrLines(bill).forEach((ln, i) => doc.text(ln, M, boxTop + 30 + i * 12));
  if (bill?.gstin) doc.text(`Buyer GSTIN: ${bill.gstin}`, M, boxTop + 30 + addrLines(bill).length * 12 + 4);

  doc.font("Helvetica-Bold").fontSize(11).text("Ship To", M + colW, boxTop);
  doc.font("Helvetica").fontSize(10);
  const ship = order.shippingAddress;
  doc.text(safe(ship?.fullName || ship?.email), M + colW, boxTop + 16);
  addrLines(ship).forEach((ln, i) => doc.text(ln, M + colW, boxTop + 30 + i * 12));
  if (ship?.phoneNumber) doc.text(`Phone: ${ship.phoneNumber}`, M + colW, boxTop + 30 + addrLines(ship).length * 12 + 4);

  let y = boxTop + 120;

  /* Items table */
  const x1 = M, x2 = x1 + 220, x3 = x2 + 60, x4 = x3 + 80, x5 = x4 + 80; // Name | HSN | Qty | Rate | Amount
  headerCell(doc, "Item", x1, y, 220);
  headerCell(doc, "HSN", x2, y, 60);
  headerCell(doc, "Qty", x3, y, 80);
  headerCell(doc, "Rate", x4, y, 80);
  headerCell(doc, "Amount", x5, y, 100);
  y += 20;

  doc.font("Helvetica").fontSize(10);
  order.items.forEach((it) => {
    tableCell(doc, it.name, x1, y, 220);
    tableCell(doc, safe(it.hsn), x2, y, 60);
    tableCell(doc, String(it.quantity), x3, y, 80);
    tableCell(doc, INRC(it.price), x4, y, 80);
    tableCell(doc, INRC(it.price * it.quantity), x5, y, 100);
    y += 20;
    if (y > doc.page.height - 180) {
      doc.addPage();
      y = M;
    }
  });

  /* Totals */
  y += 10;
  const rightColX = 340;
  doc.font("Helvetica-Bold").text("Summary", rightColX, y);
  y += 18;

  const line = (label: string, value: string) => {
    doc.font("Helvetica").text(label, rightColX, y);
    doc.text(value, rightColX + 140, y, { width: 120, align: "right" });
    y += 16;
  };

  line("Subtotal", INRC(order.subtotal));
  if (order.shipping && order.shipping > 0) line("Shipping", INRC(order.shipping));
  const gstPct = order.gst?.taxPercent ?? Math.round((order.tax / Math.max(1, order.subtotal)) * 100);
  line(`GST (${gstPct}%)`, INRC(order.tax));
  doc.font("Helvetica-Bold");
  line("Total", INRC(order.total));
  doc.font("Helvetica");

  /* GST footer */
  y += 12;
  if (order.gst?.wantInvoice) {
    const pos = order.gst.placeOfSupply || bill?.placeOfSupply || bill?.state || "";
    doc.fontSize(9).fillColor("#374151");
    doc.text(`Place of Supply: ${pos}`, rightColX, y);
    y += 12;
    if (order.gst?.gstin) {
      doc.text(`Buyer GSTIN: ${order.gst.gstin}`, rightColX, y);
      y += 12;
    }
    doc.fillColor("black");
  }

  /* Notes */
  y += 18;
  doc.fontSize(8).fillColor("#6B7280");
  doc.text(
    "This is a computer generated invoice. Prices in INR. Subject to jurisdiction.",
    M,
    y
  );
  doc.fillColor("black");
}

/* -------- Public API -------- */

/**
 * Create a PDF stream for direct piping to an HTTP response.
 * Usage in controller:
 *    const { stream, filename } = createInvoicePdfStream(order, seller);
 *    res.setHeader('Content-Type','application/pdf');
 *    res.setHeader('Content-Disposition',`inline; filename="${filename}"`);
 *    stream.pipe(res);
 */
export function createInvoicePdfStream(order: InvoiceOrder, seller: {
  name: string;
  addressLines: string[];
  gstin?: string;
  cin?: string;
  supportEmail?: string;
  supportPhone?: string;
}) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const stream = new PassThrough();
  doc.pipe(stream);

  render(doc, order, seller);
  doc.end();

  const created = order.createdAt ? dayjs(order.createdAt) : dayjs();
  const filename =
    `invoice_${(order.invoiceNumber || order.orderNumber || String(order._id)).toString()}_${created.format("YYYYMMDD")}.pdf`;

  return { stream, filename };
}

/**
 * Generate a Buffer if you need to upload to S3 or attach to email.
 */
export function generateInvoiceBuffer(order: InvoiceOrder, seller: {
  name: string;
  addressLines: string[];
  gstin?: string;
  cin?: string;
  supportEmail?: string;
  supportPhone?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    render(doc, order, seller);
    doc.end();
  });
}
