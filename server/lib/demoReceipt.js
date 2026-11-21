const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

function receiptMessage(booking, customer, from) {
  const payment = booking.demoPayment;
  const amount = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", currencyDisplay: "code" }).format(payment.amount);
  const date = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "long", timeStyle: "short", timeZone: "Africa/Johannesburg",
  }).format(payment.paidAt) + " SAST";
  const details = [
    ["Service", payment.serviceName], ["Amount", amount], ["Booking reference", booking._id],
    ["Transaction reference", payment.reference], ["Date", date], ["DEMO payment status", "Confirmed"],
  ];
  const rows = details.map(([label, value]) =>
    `<tr><th scope="row" style="padding:12px 8px;text-align:left;border-bottom:1px solid #dce7e6">${label}</th><td style="padding:12px 8px;overflow-wrap:anywhere;border-bottom:1px solid #dce7e6">${escapeHtml(value)}</td></tr>`
  ).join("");
  return {
    from,
    to: { address: customer.email },
    subject: "LocalTrustSA | DEMO payment receipt",
    messageId: `<${payment.reference.toLowerCase()}@${from.split("@").at(-1)}>`,
    text: `Hello ${customer.name},\n\nYour DEMO payment is confirmed. No real money was transferred.\n\n` +
      details.map(([label, value]) => `${label}: ${value}`).join("\n"),
    html: `<!doctype html><html lang="en"><meta charset="utf-8"><body style="background:#edf5f4;margin:0;padding:24px;font-family:Arial,sans-serif;color:#163b39">
      <main style="max-width:600px;margin:auto;background:#fff;border-radius:16px;overflow:hidden">
        <header style="background:#124c47;color:#fff;padding:24px"><strong>LocalTrustSA</strong><h1>DEMO payment receipt</h1></header>
        <section style="padding:24px"><p>Hello ${escapeHtml(customer.name)},</p>
        <p>Your DEMO payment is confirmed. <strong>No real money was transferred.</strong></p>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
        <p style="margin-top:24px;color:#42625f">University presentation · Simulated electronic payment</p></section>
      </main></body></html>`,
  };
}

const mailbox = /^[\w.+%'-]+@[\w.-]+\.[a-z]{2,}$/i;
const previewSender = "receipts@localtrust.test";

async function submitReceipt(booking, customer, env = process.env) {
  if (!mailbox.test(customer.email)) return "failed";
  if (env.DEMO_RECEIPT_MODE === "preview") return "preview";
  if (env.DEMO_RECEIPT_MODE !== "smtp") return "failed";
  return submitMessage(customer.email, from => receiptMessage(booking, customer, from), env);
}

async function submitMessage(email, build, env = process.env) {
  if (!mailbox.test(email)) return "failed";
  // Even if SMTP is configured in .env, test processes never open an SMTP connection.
  if (env.NODE_ENV === "test" || env.NODE_TEST_CONTEXT) return "failed";
  const from = env.DEMO_SMTP_FROM;
  const port = Number(env.DEMO_SMTP_PORT || 587);
  if (!env.DEMO_SMTP_HOST || !env.DEMO_SMTP_USER || !env.DEMO_SMTP_PASS ||
      !from || !mailbox.test(from) || ![465, 587].includes(port)) return "failed";

  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") return "failed";
    throw error;
  }
  const transport = nodemailer.createTransport({
    host: env.DEMO_SMTP_HOST, port, secure: port === 465, requireTLS: port === 587,
    auth: { user: env.DEMO_SMTP_USER, pass: env.DEMO_SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail(build(from));
    return result.accepted.length ? "submitted" : "failed";
  } catch (error) {
    // Retry only when SMTP explicitly refused the message or submission never started.
    const rejected = error.responseCode >= 400 && error.responseCode < 600;
    const beforeSubmission = ["EDNS", "EAUTH", "ETLS", "EENVELOPE"].includes(error.code) ||
      ["CONN", "EHLO", "HELO", "STARTTLS", "MAIL FROM", "RCPT TO"].includes(error.command);
    return rejected || beforeSubmission ? "failed" : "uncertain";
  } finally {
    transport.close?.();
  }
}

module.exports = { receiptMessage, submitReceipt, submitMessage, escapeHtml, previewSender };
