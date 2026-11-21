import { useState } from "react";
import api from "../Services/api";
import type { Booking } from "../types";
import { errorMessage } from "../lib/marketplace";
import { Notice } from "./UI";

export default function BookingEmailPreview({ booking }: { booking: Booking }) {
  const events = booking.timeline?.filter(item => item.bookingStatus && item._id) ?? [];
  const [selected, setSelected] = useState("");
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!events.length) return null;

  async function preview(id: string) {
    setSelected(id);
    setBusy(true);
    setError("");
    setHtml("");
    try {
      const { data } = await api.get<{ html: string }>(`/bookings/${booking._id}/email-preview/${id}`);
      setHtml(data.html);
    } catch (err) { setError(errorMessage(err, "Unable to open the email preview.")); }
    finally { setBusy(false); }
  }

  return <details className="booking-email-preview"><summary>Booking email previews</summary>
    <div className="action-row">{events.map(item => <button key={item._id} className="text-button" disabled={busy}
      aria-pressed={selected === item._id} onClick={() => void preview(item._id!)}>{item.bookingStatus === "pending" ? "Requested" : item.bookingStatus}</button>)}</div>
    {busy && <p role="status">Loading email preview…</p>}
    {error && <Notice>{error}</Notice>}
    {html && <iframe className="demo-email-preview" title="Booking email preview" sandbox="" srcDoc={html} />}
  </details>;
}
