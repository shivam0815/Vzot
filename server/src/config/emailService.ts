// src/config/emailService.ts
import nodemailer from 'nodemailer';

/** Minimal shape we actually use inside emails (decoupled from Mongoose types) */
type EmailOrderLike = {
  _id: any;
  orderNumber?: string; // ← made optional
  total?: number | null;
  createdAt: Date | string | number;
  paymentMethod: string;
  items?: Array<{ name?: string; quantity?: number; price?: number }>;
  shippingAddress: { fullName: string; email: string; phoneNumber: string };
  trackingNumber?: string;
  orderStatus?: string;

  // Optional (for shipping payment emails)
  shippingPackage?: {
    lengthCm?: number;
    breadthCm?: number;
    heightCm?: number;
    weightKg?: number;
    notes?: string;
    images?: string[];
    packedAt?: Date | string | number;
  };
  shippingPayment?: {
    linkId?: string;
    shortUrl?: string;
    status?: 'pending' | 'paid' | 'partial' | 'expired' | 'cancelled';
    currency?: string;
    amount?: number;
    amountPaid?: number;
    paymentIds?: string[];
    paidAt?: Date | string | number;
  };
};

interface EmailTemplate {
  subject: string;
  html: string;
}

interface SMSConfig {
  apiKey: string;
  senderId: string;
  endpoint: string;
}

/** helpers */
const toId = (v: any) => (typeof v === 'string' ? v : v?.toString?.() ?? '');
const money = (n?: number | null) => (Number(n ?? 0)).toFixed(2);
const orderNo = (o: EmailOrderLike) => (o.orderNumber && String(o.orderNumber)) || toId(o._id);

class EmailAutomationService {
  private transporter: nodemailer.Transporter;
  private smsConfig: SMSConfig;
  private adminEmails: string[];

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.smsConfig = {
      apiKey: process.env.SMS_API_KEY || '',
      senderId: process.env.SMS_SENDER_ID || 'NAKODA',
      endpoint: process.env.SMS_ENDPOINT || 'https://api.textlocal.in/send/',
    };

    this.adminEmails =
      process.env.AUTHORIZED_ADMIN_EMAILS?.split(',').map((e) => e.trim()) ||
      ['admin@nakodamobile.com'];

    this.testConnection();
  }

  private async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connected successfully');
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
    }
  }

  /* ==================== PUBLIC API ==================== */

  async sendOrderConfirmation(order: EmailOrderLike, customerEmail: string): Promise<boolean> {
    const template = this.getOrderConfirmationTemplate(order);
    try {
      await this.transporter.sendMail({
        from: `"${process.env.COMPANY_NAME || 'Nakoda Mobile'}" <${process.env.SMTP_USER}>`,
        to: customerEmail,
        subject: template.subject,
        html: template.html,
      });

      await this.sendSMS(
        order.shippingAddress.phoneNumber,
        `🎉 Order confirmed! Order #${orderNo(order)} for ₹${money(order.total)}. Track: ${process.env.APP_BASE_URL || 'https://nakodamobile.com'}/track/${toId(order._id)}`
      );

      console.log('✅ Order confirmation sent:', orderNo(order));
      return true;
    } catch (error) {
      console.error('❌ Email/SMS failed:', error);
      return false;
    }
  }

  async notifyAdminNewOrder(order: EmailOrderLike): Promise<boolean> {
    const template = this.getAdminOrderNotificationTemplate(order);
    try {
      await Promise.all(
        this.adminEmails.map((email) =>
          this.transporter.sendMail({
            from: `"${process.env.COMPANY_NAME || 'Nakoda Mobile'} System" <${process.env.SMTP_USER}>`,
            to: email,
            subject: template.subject,
            html: template.html,
            priority: 'high',
          })
        )
      );
      console.log('✅ Admin notifications sent for order:', orderNo(order));
      return true;
    } catch (error) {
      console.error('❌ Admin notification failed:', error);
      return false;
    }
  }

  async sendOrderStatusUpdate(order: EmailOrderLike, previousStatus: string): Promise<boolean> {
    const template = this.getStatusUpdateTemplate(order, previousStatus);
    try {
      await this.transporter.sendMail({
        from: `"${process.env.COMPANY_NAME || 'Nakoda Mobile'}" <${process.env.SMTP_USER}>`,
        to: order.shippingAddress.email,
        subject: template.subject,
        html: template.html,
      });

      if (['shipped', 'delivered', 'cancelled'].includes(order.orderStatus || '')) {
        const smsMessage = this.getStatusSMSMessage(order);
        await this.sendSMS(order.shippingAddress.phoneNumber, smsMessage);
      }

      console.log('✅ Status update sent:', orderNo(order), order.orderStatus);
      return true;
    } catch (error) {
      console.error('❌ Status update failed:', error);
      return false;
    }
  }

  /**
   * New: Send shipping payment link email (and SMS).
   * Backwards compatible with your controller usage:
   *   EmailAutomationService.sendShippingPaymentLink(order, link.short_url)
   *
   * You can also pass a richer payload:
   *   EmailAutomationService.sendShippingPaymentLink(order, { shortUrl, linkId, amount, currency, lengthCm, ... })
   */
  async sendShippingPaymentLink(
    order: EmailOrderLike,
    arg:
      | string
      | {
          shortUrl: string;
          linkId?: string;
          amount?: number;
          currency?: string;
          lengthCm?: number;
          breadthCm?: number;
          heightCm?: number;
          weightKg?: number;
          notes?: string;
          images?: string[];
        }
  ): Promise<boolean> {
    const fallback = {
      shortUrl: order.shippingPayment?.shortUrl || '',
      linkId: order.shippingPayment?.linkId,
      amount: order.shippingPayment?.amount || 0,
      currency: order.shippingPayment?.currency || 'INR',
      lengthCm: order.shippingPackage?.lengthCm,
      breadthCm: order.shippingPackage?.breadthCm,
      heightCm: order.shippingPackage?.heightCm,
      weightKg: order.shippingPackage?.weightKg,
      notes: order.shippingPackage?.notes,
      images: order.shippingPackage?.images || [],
    };

    const payload = typeof arg === 'string' ? { ...fallback, shortUrl: arg } : { ...fallback, ...arg };

    const subject = `Pay Shipping Charges for Order #${orderNo(order)}`;
    const photoStrip =
      (payload.images || [])
        .slice(0, 5)
        .map(
          (u) =>
            `<img src="${u}" alt="package" style="max-width:100%;border-radius:8px;margin:6px 0;" />`
        )
        .join('') || '';

    const dims =
      [payload.lengthCm, payload.breadthCm, payload.heightCm].some((v) => !!v)
        ? `${payload.lengthCm ?? '-'} × ${payload.breadthCm ?? '-'} × ${payload.heightCm ?? '-'} cm`
        : '-';

    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>📦 Shipping Payment Requested</h2>
        <p>Order <b>#${orderNo(order)}</b></p>
        <p><b>Amount:</b> ${payload.currency || 'INR'} ${money(payload.amount)}</p>
        <p><b>Package:</b> ${dims}, ${payload.weightKg ?? '-'} kg</p>
        ${payload.notes ? `<p><i>${payload.notes}</i></p>` : ''}
        ${photoStrip ? `<div style="margin:12px 0">${photoStrip}</div>` : ''}
        <p style="margin-top:16px">
          <a href="${payload.shortUrl}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Pay Shipping Now
          </a>
        </p>
        <p style="font-size:12px;color:#777;margin-top:8px">If the button doesn't work, open this link: ${payload.shortUrl}</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${process.env.COMPANY_NAME || 'Nakoda Mobile'}" <${process.env.SMTP_USER}>`,
        to: order.shippingAddress.email,
        subject,
        html,
      });

      // Optional SMS
      await this.sendSMS(
        order.shippingAddress.phoneNumber,
        `Pay shipping for order #${orderNo(order)}: ${payload.shortUrl}`
      );

      console.log('✅ Shipping payment email sent:', orderNo(order), payload.linkId || payload.shortUrl);
      return true;
    } catch (e) {
      console.error('❌ sendShippingPaymentLink failed', e);
      return false;
    }
  }

  /**
   * Email/SMS summary after the shipping payment link changes state
   * (paid / partially paid / expired / cancelled).
   */
  async sendShippingPaymentReceipt(
    order: EmailOrderLike,
    payload: { status: 'pending' | 'paid' | 'partial' | 'expired' | 'cancelled'; amount?: number; shortUrl?: string }
  ): Promise<boolean> {
    const labels: Record<typeof payload.status, { title: string; body: string }> = {
      paid:    { title: '✅ Shipping Payment Received', body: `We’ve received your shipping payment of ₹${money(payload.amount)} for order #${orderNo(order)}.` },
      partial: { title: '🟡 Shipping Payment Partially Paid', body: `We’ve received a partial shipping payment of ₹${money(payload.amount)} for order #${orderNo(order)}. Please complete the remaining amount.` },
      expired: { title: '⌛ Shipping Payment Link Expired', body: `Your shipping payment link for order #${orderNo(order)} has expired. Please contact support to get a new link.` },
      cancelled: { title: '❌ Shipping Payment Cancelled', body: `The shipping payment link for order #${orderNo(order)} was cancelled.` },
      pending: { title: '🔔 Shipping Payment Pending', body: `Your shipping payment for order #${orderNo(order)} is pending.` },
    };

    const { title, body } = labels[payload.status];

    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>${title}</h2>
        <p>${body}</p>
        ${payload.shortUrl ? `<p><a href="${payload.shortUrl}">Open payment link</a></p>` : ''}
        <p style="margin-top:12px">
          <a href="${process.env.APP_BASE_URL || 'https://nakodamobile.com'}/orders/${toId(order._id)}">View order details</a>
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${process.env.COMPANY_NAME || 'Nakoda Mobile'}" <${process.env.SMTP_USER}>`,
        to: order.shippingAddress.email,
        subject: `${title} • #${orderNo(order)}`,
        html,
      });

      // Optional SMS
      const smsMsgBase = title.replace(/✅|🟡|⌛|❌|🔔/g, '').trim();
      await this.sendSMS(
        order.shippingAddress.phoneNumber,
        `${smsMsgBase} for #${orderNo(order)}${payload.shortUrl ? `: ${payload.shortUrl}` : ''}`
      );

      return true;
    } catch (e) {
      console.error('❌ sendShippingPaymentReceipt failed', e);
      return false;
    }
  }

  /* ==================== PRIVATE ==================== */

  private async sendSMS(phoneNumber: string, message: string): Promise<void> {
    if (!this.smsConfig.apiKey) {
      console.log('⚠️ SMS API not configured, skipping SMS');
      return;
    }
    try {
      const response = await fetch(this.smsConfig.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: this.smsConfig.apiKey,
          numbers: phoneNumber.replace('+91', ''),
          message,
          sender: this.smsConfig.senderId,
        }),
      });
      if (response.ok) {
        console.log('✅ SMS sent to:', phoneNumber);
      }
    } catch (error) {
      console.error('❌ SMS failed:', error);
    }
  }

  private getOrderConfirmationTemplate(order: EmailOrderLike): EmailTemplate {
    return {
      subject: `Order Confirmed - #${orderNo(order)} | ${process.env.COMPANY_NAME || 'Nakoda Mobile'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
              <h1 style="margin: 0;">🎉 Order Confirmed!</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">Thank you for choosing ${process.env.COMPANY_NAME || 'Nakoda Mobile'}</p>
            </div>
            
            <div style="padding: 30px;">
              <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h2 style="color: #27ae60; margin: 0 0 10px 0;">Order Details</h2>
                <p><strong>Order Number:</strong> #${orderNo(order)}</p>
                <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                <p><strong>Payment Method:</strong> ${String(order.paymentMethod || '').toUpperCase()}</p>
                <p><strong>Total Amount:</strong> ₹${money(order.total)}</p>
              </div>

              <h3>📦 Items Ordered:</h3>
              <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
                ${order.items?.map(item => `
                  <div style="padding: 15px; border-bottom: 1px solid #eee;">
                    <h4 style="margin: 0 0 5px 0;">${item.name || 'Product'}</h4>
                    <p style="margin: 0; color: #666;">Quantity: ${item.quantity || 0} × ₹${money(item.price)}</p>
                    <div style="font-weight: bold;">₹${money((item.quantity || 0) * (item.price || 0))}</div>
                  </div>
                `).join('') || '<p style="padding:12px">No items found</p>'}
              </div>

              <div style="background: #fff3cd; padding: 20px; border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">🚚 What's Next?</h4>
                <ul style="margin: 0; padding-left: 20px; color: #856404;">
                  <li>Your order is being processed</li>
                  <li>You'll receive tracking details once shipped</li>
                  <li>Estimated delivery: 3-5 business days</li>
                </ul>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  private getAdminOrderNotificationTemplate(order: EmailOrderLike): EmailTemplate {
    return {
      subject: `🚨 NEW ORDER - #${orderNo(order)} - ₹${money(order.total)}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: white;">
            <div style="background: #dc3545; padding: 20px; text-align: center; color: white;">
              <h1>🚨 NEW ORDER RECEIVED</h1>
              <p>Order #${orderNo(order)} - ₹${money(order.total)}</p>
            </div>
            <div style="padding: 30px;">
              <p><strong>Customer:</strong> ${order.shippingAddress?.fullName || 'Unknown'}</p>
              <p><strong>Email:</strong> ${order.shippingAddress?.email || 'Unknown'}</p>
              <p><strong>Phone:</strong> ${order.shippingAddress?.phoneNumber || 'Unknown'}</p>
              <p><strong>Total:</strong> ₹${money(order.total)}</p>
              <p><strong>Items:</strong> ${order.items?.length || 0}</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  private getStatusUpdateTemplate(order: EmailOrderLike, previousStatus: string): EmailTemplate {
    return {
      subject: `Order Update - #${orderNo(order)} | ${process.env.COMPANY_NAME || 'Nakoda Mobile'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: white;">
            <div style="background: #28a745; padding: 20px; text-align: center; color: white;">
              <h1>📦 Order Status Updated</h1>
              <p>Order #${orderNo(order)}</p>
            </div>
            <div style="padding: 30px;">
              <p>Your order status has been updated from <strong>${previousStatus}</strong> to <strong>${order.orderStatus}</strong></p>
              ${order.trackingNumber ? `<p><strong>Tracking Number:</strong> ${order.trackingNumber}</p>` : ''}
              <p><a href="${process.env.APP_BASE_URL || 'https://nakodamobile.com'}/track/${toId(order._id)}">Track your order</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  private getStatusSMSMessage(order: EmailOrderLike): string {
    const messages: Record<string, string> = {
      shipped: `📦 Your order #${orderNo(order)} has been shipped${order.trackingNumber ? ` (Track: ${order.trackingNumber})` : ''}. Expected delivery in 2-3 days.`,
      delivered: `🎉 Your order #${orderNo(order)} has been delivered. Thank you for choosing ${process.env.COMPANY_NAME || 'Nakoda Mobile'}!`,
      cancelled: `❌ Order #${orderNo(order)} has been cancelled. Refund will be processed within 3-5 business days if applicable.`,
    };
    return messages[order.orderStatus || ''] || `Order #${orderNo(order)} status updated to ${order.orderStatus}`;
  }
}

const emailAutomationService = new EmailAutomationService();
export default emailAutomationService;
