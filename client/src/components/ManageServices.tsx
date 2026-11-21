import { useEffect, useState, type FormEvent } from "react";
import api from "../Services/api";
import type { Service } from "../types";
import { categories, errorMessage, money } from "../lib/marketplace";
import { EmptyState, Loading, Notice } from "./UI";

export default function ManageServices({ revision }: { revision: number }) {
  const [services, setServices] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get<Service[]>("/services/my", { signal: controller.signal }).then(({ data }) => { setServices(data); setError(""); }).catch(err => { if (!controller.signal.aborted) setError(errorMessage(err, "Unable to load your listings.")); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, retry]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing || busy) return;
    setBusy(true); setError("");
    try { const { data } = await api.patch<Service>(`/services/${editing._id}`, { ...editing, active: editing.active !== false }); setServices(items => items.map(item => item._id === data._id ? data : item)); setEditing(null); }
    catch (err) { setError(errorMessage(err, "Unable to save service.")); }
    finally { setBusy(false); }
  }
  return <section className="panel managed-services"><div className="panel-heading"><div><h2>My services</h2><p className="subtle">Edit prices and details, or pause a listing.</p></div></div>
    {error && <><Notice>{error}</Notice><button className="text-button" onClick={() => setRetry(n => n + 1)}>Retry loading</button></>}
    {loading ? <Loading text="Loading your services…" /> : editing ? <form className="publish-form" onSubmit={save}>
      <label>Title<input required maxLength={120} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></label>
      <label>Category<select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>{categories.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
      <label>Price (ZAR)<input required type="number" min="0" max="1000000" step="0.01" value={editing.price} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} /></label>
      <label>Service area<input required maxLength={160} value={editing.location} onChange={e => setEditing({ ...editing, location: e.target.value })} /></label>
      <button type="button" className="button secondary small" onClick={()=>{if(!navigator.geolocation){setError('Location is unavailable.');return;}navigator.geolocation.getCurrentPosition(position=>setEditing({...editing,coordinates:{type:'Point',coordinates:[position.coords.longitude,position.coords.latitude]}}),()=>setError('Location access unavailable. Your existing map location was kept.'));}}>Use my location for radius searches</button><p className="field-hint">{editing.coordinates?'Map location set. Saved when you choose Save changes.':'No map location yet. Radius searches show mapped listings only.'}</p>
      <label>Description<textarea required maxLength={3000} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></label>
      <label>Availability<select value={editing.active === false ? "paused" : "active"} onChange={e => setEditing({ ...editing, active: e.target.value === "active" })}><option value="active">Active in marketplace</option><option value="paused">Paused</option></select></label>
      <div className="action-row"><button className="button small" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button><button type="button" className="button secondary small" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div>
    </form> : services.length ? <div className="booking-list">{services.map(service => <article className="booking-card" key={service._id}><div className="booking-top"><h3>{service.title}</h3><span className="status">{service.active === false ? "Paused" : "Active"}</span></div><p className="subtle">{money(service.price)} · {service.location}</p><button className="button secondary small" onClick={() => setEditing(service)}>Edit service</button></article>)}</div> : !error && <EmptyState title="No services yet">Publish your first service using the form above.</EmptyState>}
  </section>;
}
