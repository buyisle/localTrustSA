import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, MapPin } from "lucide-react";
import api from "../Services/api";
import type { Service } from "../types";
import { useAuth } from "../context/auth";
import { money, errorMessage } from "../lib/marketplace";
import { Loading, Notice } from "../components/UI";
import ProviderAvatar from "../components/ProviderAvatar";
import ServiceImage from "../components/ServiceImage";
import BookingDialog from "../components/BookingDialog";
import ServiceReviews from "../components/ServiceReviews";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProviderProfile() {
  const { id } = useParams();
  return <Profile key={id} id={id} />;
}

function Profile({ id }: { id?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(false);
  const [reviews, setReviews] = useState(false);
  const [success, setSuccess] = useState(false);
  const [openingThread, setOpeningThread] = useState(false);
  const [messageError, setMessageError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api.get<Service>(`/services/${id}`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setService(data); })
      .catch(err => { if (!controller.signal.aborted) setError(errorMessage(err, "Provider unavailable.")); });
    return () => controller.abort();
  }, [id]);

  if (error) return <main className="container section"><Notice>{error}</Notice><Link to="/#services">Back to services</Link></main>;
  if (!service) return <main className="container section"><Loading text="Loading provider…" /></main>;

  const hours = service.availability;
  async function messageProvider(provider: string) {
    setOpeningThread(true);
    setMessageError("");
    try {
      const { data } = await api.post<{ _id: string }>("/messages", { provider });
      navigate(`/messages/${data._id}`);
    } catch (err) { setMessageError(errorMessage(err, "Unable to open a conversation.")); }
    finally { setOpeningThread(false); }
  }
  return <main className="container section">
    <Link className="text-button" to="/#services">Back to services</Link>
    <div className="profile-grid">
      <section className="panel">
        <ServiceImage category={service.category} image={service.image} />
        <div className="profile-name"><ProviderAvatar provider={service.provider} /><div>
          <h1>{service.provider?.name || "Local provider"}</h1>
          {service.demo ? <p className="demo-label">Demo provider · fictional listing</p> : service.verified && <p className="verified-label"><BadgeCheck size={16} /> Verified provider</p>}
        </div></div>
        <div className="profile-service-detail"><span className="category-tag teal">{service.category}</span><h2>{service.title}</h2><p className="meta"><MapPin size={17} />{service.location}</p><p>{service.description}</p></div>
        {service.biography && <div><h3>About the provider</h3><p>{service.biography}</p></div>}
        {service.experience && <div><h3>Skills and experience</h3><p>{service.experience}</p></div>}
        {!!service.offers?.length && <div><h3>More services from this provider</h3><div className="profile-offers">{service.offers.map(offer => <Link key={offer._id} to={`/services/${offer._id}`}><strong>{offer.title}</strong><span>{offer.category} ? {money(offer.price)}</span></Link>)}</div></div>}
        <div><h3>Customer feedback</h3><p>{service.reviewCount ? `${service.rating?.toFixed(1)} out of 5 from ${service.reviewCount} approved ${service.reviewCount === 1 ? "review" : "reviews"}` : "No reviews yet."}</p>
          {Boolean(service.reviewCount) && <button className="text-button" onClick={() => setReviews(true)}>Read approved reviews</button>}
        </div>
        <div><h3>Portfolio</h3>{service.portfolio?.length ? <div className="portfolio-grid">{service.portfolio.map(photo =>
          <figure key={photo.url}><img src={photo.url} alt={photo.caption || "Provider portfolio work"} loading="lazy" /><figcaption>{photo.caption}</figcaption></figure>
        )}</div> : <p className="subtle">No provider-uploaded portfolio photos yet.</p>}</div>
      </section>
      <aside className="panel profile-booking">
        <div><p className="subtle">Service price</p><h2>{money(service.price)}</h2></div>
        <div><h3>Availability</h3><p>{hours?.days?.length ? `${hours.days.map(day => weekdays[day]).join(", ")} · ${hours.startHour}:00–${hours.endHour}:00` : "See available times when booking."}</p>
          <p className="subtle">One-hour appointments in South African time.</p></div>
        {success && <Notice success>Booking requested. <Link to="/dashboard">View my bookings</Link></Notice>}
        {messageError && <Notice>{messageError}</Notice>}
        {user?.role === "customer" ? <button className="button full" onClick={() => setBooking(true)}>Request a booking</button> :
          !user ? <Link className="button full" to={`/login?service=${service._id}`}>Log in to book</Link> :
          <p className="subtle">Customer accounts can request bookings.</p>}
        {user?.role === "customer" && service.provider && <button className="button secondary full" disabled={openingThread}
          onClick={() => service.provider && void messageProvider(service.provider._id)}>Message provider</button>}
      </aside>
    </div>
    {booking && <BookingDialog service={service} onClose={() => setBooking(false)} onSuccess={() => { setBooking(false); setSuccess(true); }} />}
    {reviews && <ServiceReviews id={service._id} title={service.title} onClose={() => setReviews(false)} />}
  </main>;
}
