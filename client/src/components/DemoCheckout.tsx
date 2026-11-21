import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CreditCard, Mail } from "lucide-react";
import api from "../Services/api";
import { errorMessage } from "../lib/marketplace";
import type { Booking, DemoPayment, User } from "../types";
import { Notice } from "./UI";

const methods = { "demo-card": "Simulated card", "demo-eft": "Simulated EFT" } as const;
const currency = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", currencyDisplay: "code" });

export default function DemoCheckout({ booking, user, now, onChange }: { booking: Booking; user: User; now: number; onChange: () => void }) {
  const [method, setMethod] = useState<DemoPayment["method"]>("demo-card");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [response, setResponse] = useState<DemoPayment>();
  const dialog = useRef<HTMLDialogElement>(null);
  const payment = response ?? booking.demoPayment;
  const path = `/bookings/${booking._id}/demo-payment`;
  const eligible = ["confirmed", "completed"].includes(booking.status) && booking.service && booking.agreedPrice !== undefined
    && !(booking.payment?.method === "simulation" && booking.payment.status === "paid");

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  async function submit(retry: boolean) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<DemoPayment>(retry ? path + "/receipt" : path, retry ? {} : { method });
      setResponse(data);
      onChange();
    } catch (err) {
      setError(errorMessage(err, retry ? "Could not check receipt delivery. Try again." : "Could not confirm the demo payment. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function showPreview() {
    if (preview) { setPreview(""); return; }
    setBusy(true);
    setError("");
    try {
      const { data } = await api.get<{ html: string }>(path + "/receipt-preview");
      setPreview(data.html);
    } catch (err) {
      setError(errorMessage(err, "Could not open the receipt preview. Try again."));
    } finally {
      setBusy(false);
    }
  }

  if (!eligible && !payment) return null;
  const expiredAttempt = payment?.receiptAttemptedAt &&
    now - Date.parse(payment.receiptAttemptedAt) > 60_000;
  const deliveryLabel = payment && {
    pending: "Receipt delivery is pending.",
    sending: expiredAttempt ? "Receipt delivery needs review. Check with support before resending." : "Receipt submission is in progress.",
    preview: "Email receipt preview is ready.",
    submitted: "Email receipt was accepted for delivery.",
    failed: "Email receipt could not be submitted. You can retry delivery.",
    uncertain: "Receipt delivery could not be verified. Check with support before resending.",
  }[payment.receiptStatus];

  return <div className="demo-checkout">
    {payment && <p className="meta"><CheckCircle2 size={17} /> DEMO payment confirmed · {currency.format(payment.amount)}</p>}
    <button className="button small secondary" onClick={() => setOpen(true)}>
      {payment ? "View DEMO confirmation" : "Open DEMO checkout"}
    </button>
    {open && <dialog className="panel demo-dialog" ref={dialog} aria-labelledby={`demo-title-${booking._id}`} onClose={() => { setOpen(false); setPreview(""); }}>
      <div className="panel-heading">
        <span className="empty-icon">{payment ? <CheckCircle2 /> : <CreditCard />}</span>
        <div><p className="eyebrow">DEMO PAYMENT</p><h2 id={`demo-title-${booking._id}`}>{payment ? "Payment confirmed" : "Review demo payment"}</h2></div>
      </div>
      <p className="demo-disclosure">University presentation · No real money {payment ? "was" : "will be"} transferred.</p>
      <dl className="demo-details">
        <div><dt>Service</dt><dd>{payment?.serviceName ?? booking.service?.title}</dd></div>
        <div><dt>Amount</dt><dd className="price">{currency.format(payment?.amount ?? booking.agreedPrice ?? 0)}</dd></div>
        <div><dt>Booking reference</dt><dd>{booking._id}</dd></div>
        <div><dt>Customer</dt><dd>{user.name}</dd></div>
        <div><dt>Registered email</dt><dd>{user.email}</dd></div>
        {payment && <>
          <div><dt>Transaction reference</dt><dd>{payment.reference}</dd></div>
          <div><dt>Method</dt><dd>{methods[payment.method]}</dd></div>
          <div><dt>Confirmed at</dt><dd>{new Date(payment.paidAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" })} SAST</dd></div>
        </>}
      </dl>
      {!payment && <label className="demo-method">Payment method
        <select value={method} onChange={event => setMethod(event.target.value as DemoPayment["method"])} disabled={busy}>
          <option value="demo-card">{methods["demo-card"]}</option>
          <option value="demo-eft">{methods["demo-eft"]}</option>
        </select>
      </label>}
      {payment && <p className="meta" role="status"><Mail size={17} /> {deliveryLabel}</p>}
      {error && <Notice>{error}</Notice>}
      <div className="action-row">
        {!payment && <button className="button" disabled={busy} onClick={() => void submit(false)}>{busy ? "Confirming…" : "Confirm DEMO payment"}</button>}
        {payment && ["pending", "failed", "sending"].includes(payment.receiptStatus) &&
          <button className="button secondary" disabled={busy} onClick={() => void submit(true)}>{busy ? "Checking…" : payment.receiptStatus === "sending" ? "Check receipt status" : "Retry receipt delivery"}</button>}
        {payment?.receiptStatus === "preview" && <button className="button secondary" disabled={busy} onClick={() => void showPreview()}>{busy ? "Loading…" : preview ? "Hide email preview" : "Preview receipt email"}</button>}
        <button className="button secondary" onClick={() => dialog.current?.close()}>Close</button>
      </div>
      {preview && <iframe className="demo-email-preview" title="DEMO receipt email" sandbox="" srcDoc={preview} />}
    </dialog>}
  </div>;
}
