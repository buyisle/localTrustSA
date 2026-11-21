import { useEffect, useState, type FormEvent } from "react";
import api from "../Services/api";
import type { Booking } from "../types";
import { errorMessage } from "../lib/marketplace";
import { Notice } from "./UI";

export default function BookingActions({ booking, provider, onChange }: { booking: Booking; provider: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  async function update(status: Booking["status"]) {
    if (busy) return;
    setBusy(true); setError("");
    try { await api.patch(`/bookings/${booking._id}/status`, { status }); onChange(); }
    catch (err) { setError(errorMessage(err, "Unable to update booking. Please try again.")); }
    finally { setBusy(false); }
  }
  async function review(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { await api.post(`/bookings/${booking._id}/review`, { rating: Number(rating), comment }); setReviewing(false); onChange(); }
    catch (err) { setError(errorMessage(err, "Unable to save review.")); }
    finally { setBusy(false); }
  }
  const open = ["pending", "confirmed"].includes(booking.status);
  return <div className="booking-actions">
    {error && <Notice>{error}</Notice>}
    {open && <div className="action-row">
      {provider && booking.status === "pending" && <button className="button small" disabled={busy} onClick={() => update("confirmed")}>Accept booking</button>}
      {provider && booking.status === "confirmed" && <button className="button small" disabled={busy || new Date(booking.bookingDate).getTime() > now} onClick={() => update("completed")}>Mark completed</button>}
      <button className="button secondary small" disabled={busy} onClick={() => update("cancelled")}>{provider ? "Decline / cancel" : "Cancel booking"}</button>
    </div>}
    {provider && booking.status === "confirmed" && new Date(booking.bookingDate).getTime() > now && <p className="field-hint">Completion is available after the scheduled time.</p>}
    {booking.review ? <blockquote className="review-quote"><strong>{booking.review.rating} / 5 stars</strong><p>{booking.review.comment}</p>
      {!provider && booking.review.moderation === "pending" && <small>Awaiting moderation</small>}
      {!provider && booking.review.moderation === "rejected" && <small>Review was not published</small>}
    </blockquote> : !provider && booking.status === "completed" && <>
      {!reviewing ? <button className="button secondary small" onClick={() => setReviewing(true)}>Leave a review</button> : <form className="publish-form" onSubmit={review}>
        <label>Rating<select value={rating} onChange={e => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} {n === 1 ? "star" : "stars"}</option>)}</select></label>
        <label>Your experience<textarea required maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} /></label>
        <div className="action-row"><button disabled={busy} className="button small">Submit review</button><button type="button" className="button secondary small" disabled={busy} onClick={() => setReviewing(false)}>Cancel</button></div>
      </form>}
    </>}
  </div>;
}
