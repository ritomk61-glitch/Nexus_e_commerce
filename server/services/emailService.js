/**
 * NEXUS Email Service
 * Sends transactional emails using Nodemailer.
 * Configure SMTP credentials in .env:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 *
 * For Gmail: use an App Password (not your login password).
 * For Outlook/Office365: use smtp-mail.outlook.com port 587.
 */
import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn("[EmailService] EMAIL_USER / EMAIL_PASS not configured — emails disabled.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for 587
    auth: { user, pass },
  });

  return transporter;
}

const FROM = () =>
  process.env.EMAIL_FROM || `"NEXUS Electronics" <${process.env.EMAIL_USER || "noreply@nexus.store"}>`;

// ─── HTML helpers ──────────────────────────────────────────────────────────────

const styles = `
  body{margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#e5e5e5}
  .wrapper{max-width:600px;margin:0 auto;background:#111827;border-radius:12px;overflow:hidden;border:1px solid #1f2937}
  .header{background:linear-gradient(135deg,#064e3b,#065f46);padding:32px 40px;text-align:center}
  .logo{font-size:28px;font-weight:900;letter-spacing:4px;color:#34d399}
  .tagline{font-size:12px;color:#6ee7b7;margin-top:4px;letter-spacing:2px;text-transform:uppercase}
  .body{padding:32px 40px}
  h2{color:#34d399;font-size:20px;margin:0 0 16px}
  p{color:#9ca3af;line-height:1.7;margin:0 0 12px;font-size:14px}
  .highlight{color:#e5e5e5;font-weight:600}
  .order-box{background:#0a0a0a;border:1px solid #1f2937;border-radius:8px;padding:20px;margin:20px 0}
  .order-id{font-size:22px;font-weight:800;color:#10b981;letter-spacing:2px}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
  th{background:#064e3b;color:#6ee7b7;text-align:left;padding:10px 12px;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:1px}
  td{padding:10px 12px;border-bottom:1px solid #1f2937;color:#d1d5db}
  .total-row td{font-weight:700;color:#34d399;border-top:2px solid #064e3b;border-bottom:none;font-size:15px}
  .badge{display:inline-block;background:#064e3b;color:#34d399;border-radius:999px;padding:4px 14px;font-size:12px;font-weight:700;letter-spacing:1px}
  .btn{display:inline-block;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;padding:12px 28px;font-weight:700;font-size:14px;margin:16px 0}
  .footer{background:#0d1117;padding:20px 40px;text-align:center;font-size:11px;color:#4b5563;border-top:1px solid #1f2937}
  .divider{border:none;border-top:1px solid #1f2937;margin:20px 0}
`;

function htmlWrap(body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${styles}</style></head>
<body><div class="wrapper">
  <div class="header">
    <div class="logo">NEXUS</div>
    <div class="tagline">Smart Electronics Platform</div>
  </div>
  <div class="body">${body}</div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} NEXUS Electronics · Smart Components, Delivered Fast<br>
    This is an automated message. Please do not reply to this email.
  </div>
</div></body></html>`;
}

// ─── Email Templates ───────────────────────────────────────────────────────────

function orderConfirmationHtml(order) {
  const itemRows = order.items
    .map(
      (i) => `<tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">₹${i.price.toLocaleString("en-IN")}</td>
      <td style="text-align:right">₹${(i.price * i.qty).toLocaleString("en-IN")}</td>
    </tr>`
    )
    .join("");

  const payBadge =
    order.paymentMethod === "cod"
      ? "💵 Cash on Delivery"
      : order.paymentMethod === "upi"
        ? "📱 UPI"
        : "💳 Card";

  return htmlWrap(`
    <h2>🎉 Order Confirmed!</h2>
    <p>Hi <span class="highlight">${order.customerName || "Valued Customer"}</span>,</p>
    <p>Your order has been placed successfully and is being processed. Here are your order details:</p>

    <div class="order-box">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Order ID</div>
      <div class="order-id">#${order.id}</div>
      <div style="margin-top:12px;font-size:13px;color:#9ca3af">
        Placed on: <span class="highlight">${new Date(order.createdAt).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div>
      <div style="margin-top:6px;font-size:13px;color:#9ca3af">
        Payment: <span class="badge">${payBadge}</span>
      </div>
    </div>

    <table>
      <thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        ${itemRows}
        <tr><td colspan="4"><hr class="divider" style="margin:4px 0;border-color:#1f2937"></td></tr>
        <tr><td colspan="3" style="text-align:right;color:#9ca3af">Subtotal</td><td style="text-align:right">₹${order.subtotal?.toLocaleString("en-IN") || 0}</td></tr>
        ${order.discount ? `<tr><td colspan="3" style="text-align:right;color:#34d399">Coupon Discount</td><td style="text-align:right;color:#34d399">-₹${order.discount.toLocaleString("en-IN")}</td></tr>` : ""}
        <tr><td colspan="3" style="text-align:right;color:#9ca3af">Shipping</td><td style="text-align:right">${order.shippingFee ? `₹${order.shippingFee}` : "FREE"}</td></tr>
        <tr><td colspan="3" style="text-align:right;color:#9ca3af">GST (18%)</td><td style="text-align:right">₹${order.gst?.toLocaleString("en-IN") || 0}</td></tr>
        <tr class="total-row"><td colspan="3" style="text-align:right">Total Payable</td><td style="text-align:right">₹${order.total?.toLocaleString("en-IN") || 0}</td></tr>
      </tbody>
    </table>

    <p><strong style="color:#e5e5e5">Delivery Address:</strong></p>
    <p style="background:#0a0a0a;border-left:3px solid #10b981;padding:12px 16px;border-radius:0 8px 8px 0;margin:0">
      ${order.shipping?.name || order.customerName}<br>
      ${order.shipping?.address}<br>
      ${order.shipping?.city}${order.shipping?.state ? ", " + order.shipping.state : ""} - ${order.shipping?.pincode}<br>
      📱 ${order.shipping?.phone || ""}
    </p>

    <hr class="divider">
    <p>Your invoice is attached to this email as a PDF. You can also download it anytime from your <strong style="color:#34d399">Profile → Orders</strong> section on the NEXUS website.</p>
    <p>We'll notify you when your order ships. Typical delivery: <strong style="color:#e5e5e5">3–7 business days</strong>.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:20px">Questions? Contact us at support@nexus.store</p>
  `);
}

function verificationEmailHtml(name, verificationLink) {
  return htmlWrap(`
    <h2>✉️ Verify Your Email Address</h2>
    <p>Hi <span class="highlight">${name || "there"}</span>,</p>
    <p>Welcome to <strong style="color:#34d399">NEXUS Electronics</strong>! To complete your registration and access all features, please verify your email address by clicking the button below:</p>

    <div style="text-align:center;margin:32px 0">
      <a href="${verificationLink}" class="btn">✅ Verify Email Address</a>
    </div>

    <p>This link will expire in <strong style="color:#e5e5e5">24 hours</strong>. If you did not create a NEXUS account, please ignore this email.</p>
    <p style="color:#6b7280;font-size:12px">If the button doesn't work, copy and paste this URL into your browser:<br><span style="color:#34d399;word-break:break-all">${verificationLink}</span></p>
  `);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Send order confirmation email with optional PDF invoice attachment.
 * @param {object} order - The order object
 * @param {Buffer|null} pdfBuffer - PDF invoice bytes (optional)
 */
export async function sendOrderConfirmationEmail(order, pdfBuffer = null) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "Email not configured" };

  const toEmail = order.userEmail || order.shipping?.email;
  if (!toEmail) return { sent: false, reason: "No recipient email" };

  const mailOptions = {
    from: FROM(),
    to: toEmail,
    subject: `✅ Order Confirmed #${order.id} — NEXUS Electronics`,
    html: orderConfirmationHtml(order),
    attachments: pdfBuffer
      ? [
          {
            filename: `NEXUS-Invoice-${order.id}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [],
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`[EmailService] Order confirmation sent to ${toEmail} (${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("[EmailService] Failed to send order confirmation:", err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Send a plain welcome/verification email.
 * Note: Firebase Auth handles its own verification links.
 * This is for custom verification scenarios or welcome emails.
 */
export async function sendWelcomeEmail(toEmail, name) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "Email not configured" };

  const mailOptions = {
    from: FROM(),
    to: toEmail,
    subject: `Welcome to NEXUS Electronics, ${name || ""}!`,
    html: htmlWrap(`
      <h2>🚀 Welcome to NEXUS!</h2>
      <p>Hi <span class="highlight">${name || "there"}</span>,</p>
      <p>Your NEXUS account is ready. Start exploring thousands of electronics components, microcontrollers, sensors, and development boards.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${process.env.SITE_URL || "http://localhost:3000"}/products" class="btn">🛒 Start Shopping</a>
      </div>
      <p style="color:#6b7280;font-size:12px">If you did not create this account, please ignore this email.</p>
    `),
  };

  try {
    const info = await transport.sendMail(mailOptions);
    console.log(`[EmailService] Welcome email sent to ${toEmail}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error("[EmailService] Failed to send welcome email:", err.message);
    return { sent: false, reason: err.message };
  }
}

export function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}
