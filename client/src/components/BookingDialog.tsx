import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CircleCheck, X } from "lucide-react";
import api from "../Services/api";
import type { Service } from "../types";
import { Notice } from "./UI";
import { errorMessage, money } from "../lib/marketplace";

const dateFormat = new Intl.DateTimeFormat("en-ZA", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Johannesburg" });
const timeFormat = new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
const localDay = new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Johannesburg" });

export default function BookingDialog({ service, onClose, onSuccess }: { service: Service; onClose: () => void; onSuccess: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [today] = useState(() => localDay.format(new Date()));
  const [day, setDay] = useState(today);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotError, setSlotError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmedRequest, setConfirmedRequest] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [readingPhotos, setReadingPhotos] = useState(false);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (!day) return;
    const controller = new AbortController();
    api.get<{ slots: string[] }>(`/bookings/availability/${service._id}`, { params: { day }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setSlots(data.slots); })
      .catch(err => { if (!controller.signal.aborted) setSlotError(errorMessage(err, "Couldn't load available times.")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [day, revision, service._id]);

  function refreshSlots() {
    setSlots([]);
    setSlotError("");
    setTime("");
    setLoading(true);
    setRevision(value => value + 1);
  }
  function close() { if (confirmedRequest) onSuccess(); else onClose(); }

  async function selectPhotos(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    setPhotos([]);
    setError("");
    if (files.length > 3 || files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1024 * 1024)) {
      input.value = "";
      setError("Choose up to three JPEG, PNG or WebP photos, 1 MB each.");
      return;
    }
    setReadingPhotos(true);
    try {
      setPhotos(await Promise.all(files.map(file => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read photo."));
        reader.readAsDataURL(file);
      }))));
    } catch {
      input.value = "";
      setError("Unable to read your photos. Please select them again.");
    } finally {
      setReadingPhotos(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || loading || readingPhotos || !slots.includes(time)) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await api.post("/bookings", { serviceId: service._id, bookingDate: time, ...(photos.length ? { photos: photos.map(photo => photo.split(",")[1]) } : {}) });
      setConfirmedRequest(true);
    } catch (err) {
      setError(errorMessage(err, "Couldn't send your booking. Please try again."));
      refreshSlots();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className="booking-dialog" aria-labelledby="booking-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <button className="icon-button dialog-close" disabled={busy} onClick={close} aria-label="Close booking"><X /></button>
    {confirmedRequest ? <>
      <span className="empty-icon"><CircleCheck /></span>
      <h2 id="booking-title">Booking requested</h2>
      <p>{service.title} with {service.provider?.name || "your local provider"}</p>
      <p className="booking-summary">{dateFormat.format(new Date(time))} SAST</p>
      <p className="field-hint">Your request is pending provider confirmation.</p>
      <Link className="button full" to="/dashboard" onClick={onSuccess}>View my bookings</Link>
    </> : <>
      <span className="empty-icon"><CalendarDays /></span>
      <h2 id="booking-title">Book {service.title}</h2>
      <p className="subtle">{service.provider?.name || "Local provider"} · {service.location}</p>
      <div className="booking-summary"><span>Service price</span><strong>{money(service.price)}</strong></div>
      {error && <Notice>{error}</Notice>}
      <form onSubmit={submit}>
        <label>Appointment date<input type="date" min={today} required value={day} disabled={busy} onChange={event => { setDay(event.target.value); setError(""); refreshSlots(); }} /></label>
        {day && (loading ? <p role="status" className="field-hint">Checking available times…</p> : slotError ? <><Notice>{slotError}</Notice><button type="button" className="text-button" onClick={refreshSlots}>Retry times</button></> : slots.length ? <label>Available time<select required value={time} disabled={busy} onChange={event => setTime(event.target.value)}><option value="">Select a time</option>{slots.map(slot => <option key={slot} value={slot}>{timeFormat.format(new Date(slot))}</option>)}</select></label> : <p role="status" className="field-hint">No times available. Choose another date.</p>)}
        <p className="field-hint">One-hour appointment in South African time (SAST). Your provider will confirm the request.</p>
        <label>Problem photos (optional)<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || readingPhotos} onChange={event => void selectPhotos(event.currentTarget)} /></label>
        <small>Up to 3 photos, 1 MB each. Visible to you and the assigned provider.</small>
        {!!photos.length && <div className="booking-photo-grid">{photos.map((photo, index) => <img src={photo} alt={`Selected photo ${index + 1}`} key={index} />)}</div>}
        <button className="button full" disabled={busy || loading || readingPhotos || !time}>{busy ? "Sending request…" : "Request booking"}</button>
      </form>
    </>}
  </dialog>;
}
