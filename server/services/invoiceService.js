/**
 * NEXUS Invoice Generator
 * Generates professional PDF invoices using PDFKit.
 * Returns a Buffer that can be attached to emails or sent as a download.
 */
import PDFDocument from "pdfkit";

// ─── Color palette ─────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0a",
  surface: "#111827",
  border: "#1f2937",
  green: "#10b981",
  greenLight: "#34d399",
  greenDark: "#064e3b",
  text: "#e5e5e5",
  muted: "#9ca3af",
  white: "#ffffff",
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function invoiceNumber(orderId) {
  const num = orderId.replace(/^NX/, "").padStart(8, "0");
  return `NEXUS-INV-${num}`;
}

/**
 * Generate a PDF invoice for the given order.
 * @param {object} order
 * @returns {Promise<Buffer>}
 */
export function generateInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `NEXUS Invoice ${invoiceNumber(order.id)}`,
        Author: "NEXUS Electronics",
        Subject: `Order ${order.id}`,
      },
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 100; // usable width
    const LEFT = 50;

    // ── Header background ──────────────────────────────────────────────────────
    doc
      .rect(0, 0, doc.page.width, 100)
      .fill(hexToRgb(C.greenDark));

    // ── Logo ───────────────────────────────────────────────────────────────────
    doc
      .fillColor(hexToRgb(C.greenLight))
      .font("Helvetica-Bold")
      .fontSize(32)
      .text("NEXUS", LEFT, 28);

    doc
      .fillColor(hexToRgb(C.greenLight))
      .font("Helvetica")
      .fontSize(10)
      .text("SMART ELECTRONICS PLATFORM", LEFT, 68);

    // ── Invoice title ──────────────────────────────────────────────────────────
    doc
      .fillColor(hexToRgb(C.white))
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("INVOICE", 350, 30, { align: "right", width: 200 });

    doc
      .fillColor(hexToRgb(C.greenLight))
      .font("Helvetica")
      .fontSize(11)
      .text(invoiceNumber(order.id), 350, 58, { align: "right", width: 200 });

    doc
      .fillColor(hexToRgb(C.white))
      .fontSize(9)
      .text(
        `Date: ${new Date(order.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`,
        350,
        78,
        { align: "right", width: 200 }
      );

    // ── Move below header ──────────────────────────────────────────────────────
    doc.moveDown(3);
    let y = 120;

    // ── Billing / Shipping details ─────────────────────────────────────────────
    doc
      .fillColor(hexToRgb(C.green))
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("BILL TO / SHIP TO", LEFT, y);

    y += 18;
    doc
      .fillColor(hexToRgb(C.text))
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(order.shipping?.name || order.customerName || "Customer", LEFT, y);

    y += 15;
    doc
      .fillColor(hexToRgb(C.muted))
      .font("Helvetica")
      .fontSize(10)
      .text(order.shipping?.address || "", LEFT, y);

    y += 13;
    doc.text(
      `${order.shipping?.city || ""}${order.shipping?.state ? ", " + order.shipping.state : ""} - ${order.shipping?.pincode || ""}`,
      LEFT,
      y
    );

    if (order.shipping?.phone) {
      y += 13;
      doc.text(`Phone: ${order.shipping.phone}`, LEFT, y);
    }

    if (order.userEmail) {
      y += 13;
      doc.text(`Email: ${order.userEmail}`, LEFT, y);
    }

    // ── Order meta (right side) ────────────────────────────────────────────────
    const metaX = 350;
    let metaY = 120;

    doc.fillColor(hexToRgb(C.green)).font("Helvetica-Bold").fontSize(10).text("ORDER DETAILS", metaX, metaY, { width: 200 });
    metaY += 18;

    const metaRows = [
      ["Order ID", `#${order.id}`],
      ["Payment", order.paymentMethod?.toUpperCase() || "COD"],
      ["Status", order.status || "Confirmed"],
    ];

    for (const [label, value] of metaRows) {
      doc.fillColor(hexToRgb(C.muted)).font("Helvetica").fontSize(9).text(label + ":", metaX, metaY, { width: 95 });
      doc.fillColor(hexToRgb(C.text)).font("Helvetica-Bold").text(value, metaX + 90, metaY, { width: 110 });
      metaY += 15;
    }

    // ── Divider ────────────────────────────────────────────────────────────────
    y = Math.max(y, metaY) + 20;
    doc.moveTo(LEFT, y).lineTo(LEFT + W, y).strokeColor(hexToRgb(C.border)).lineWidth(1).stroke();
    y += 15;

    // ── Items table header ─────────────────────────────────────────────────────
    const colX = [LEFT, LEFT + 230, LEFT + 320, LEFT + 400, LEFT + W - 10];
    const colWidths = [colX[1] - colX[0], colX[2] - colX[1], colX[3] - colX[2], colX[4] - colX[3]];

    // Header background
    doc.rect(LEFT - 5, y - 5, W + 10, 24).fill(hexToRgb(C.greenDark));

    doc.fillColor(hexToRgb(C.greenLight)).font("Helvetica-Bold").fontSize(9);
    doc.text("PRODUCT", colX[0], y, { width: colWidths[0] });
    doc.text("QTY", colX[1], y, { width: colWidths[1], align: "center" });
    doc.text("UNIT PRICE", colX[2], y, { width: colWidths[2], align: "right" });
    doc.text("AMOUNT", colX[3], y, { width: colWidths[3], align: "right" });

    y += 24;

    // ── Item rows ──────────────────────────────────────────────────────────────
    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      if (i % 2 === 0) {
        doc.rect(LEFT - 5, y - 4, W + 10, 20).fill([20, 20, 20]);
      }

      doc.fillColor(hexToRgb(C.text)).font("Helvetica").fontSize(9);

      const itemName = item.name.length > 36 ? item.name.substring(0, 33) + "..." : item.name;
      doc.text(itemName, colX[0], y, { width: colWidths[0] });
      doc.text(String(item.qty), colX[1], y, { width: colWidths[1], align: "center" });
      doc.text(`₹${item.price.toLocaleString("en-IN")}`, colX[2], y, { width: colWidths[2], align: "right" });
      doc.text(`₹${(item.price * item.qty).toLocaleString("en-IN")}`, colX[3], y, { width: colWidths[3], align: "right" });

      y += 22;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
    }

    // ── Totals ─────────────────────────────────────────────────────────────────
    y += 10;
    doc.moveTo(LEFT + 280, y).lineTo(LEFT + W, y).strokeColor(hexToRgb(C.border)).stroke();
    y += 10;

    const totalsX = LEFT + 290;
    const valX = LEFT + W - 10;

    function totalRow(label, value, highlight = false) {
      doc
        .fillColor(highlight ? hexToRgb(C.green) : hexToRgb(C.muted))
        .font(highlight ? "Helvetica-Bold" : "Helvetica")
        .fontSize(highlight ? 11 : 9)
        .text(label, totalsX, y, { width: 90 });
      doc
        .fillColor(highlight ? hexToRgb(C.greenLight) : hexToRgb(C.text))
        .font(highlight ? "Helvetica-Bold" : "Helvetica")
        .text(value, valX - 80, y, { width: 90, align: "right" });
      y += highlight ? 18 : 14;
    }

    totalRow("Subtotal", `₹${(order.subtotal || 0).toLocaleString("en-IN")}`);
    if (order.discount) {
      totalRow("Discount", `-₹${order.discount.toLocaleString("en-IN")}`);
    }
    totalRow("Shipping", order.shippingFee ? `₹${order.shippingFee}` : "FREE");
    totalRow("GST (18%)", `₹${(order.gst || 0).toLocaleString("en-IN")}`);

    y += 4;
    doc.moveTo(totalsX, y).lineTo(LEFT + W, y).strokeColor(hexToRgb(C.green)).lineWidth(1.5).stroke();
    y += 8;
    totalRow("TOTAL PAYABLE", `₹${(order.total || 0).toLocaleString("en-IN")}`, true);

    // ── Payment status ─────────────────────────────────────────────────────────
    y += 20;
    const payStatus =
      order.paymentMethod === "cod"
        ? "Payment due on delivery (Cash on Delivery)"
        : order.paymentStatus || "Paid";

    doc
      .rect(LEFT, y, W, 36)
      .fill(hexToRgb(C.surface));

    doc
      .fillColor(hexToRgb(C.muted))
      .font("Helvetica")
      .fontSize(9)
      .text("Payment Status:", LEFT + 12, y + 10);

    doc
      .fillColor(hexToRgb(C.green))
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(payStatus, LEFT + 110, y + 10, { width: W - 120 });

    // ── Footer ─────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 80;
    doc
      .moveTo(LEFT, footerY)
      .lineTo(LEFT + W, footerY)
      .strokeColor(hexToRgb(C.border))
      .lineWidth(0.5)
      .stroke();

    doc
      .fillColor(hexToRgb(C.muted))
      .font("Helvetica")
      .fontSize(8)
      .text("NEXUS Electronics · Smart Components, Delivered Fast", LEFT, footerY + 12, {
        align: "center",
        width: W,
      });

    doc
      .text(
        "This is a computer-generated invoice and does not require a physical signature.",
        LEFT,
        footerY + 26,
        { align: "center", width: W }
      );

    doc
      .fillColor(hexToRgb(C.green))
      .text(`${invoiceNumber(order.id)} · © ${new Date().getFullYear()} NEXUS Electronics`, LEFT, footerY + 40, {
        align: "center",
        width: W,
      });

    doc.end();
  });
}

export { invoiceNumber };
