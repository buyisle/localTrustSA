import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Handshake, MapPin, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import heroPhoto from "../assets/marketplace-hero.jpg";
import api from "../Services/api";
import type { Service } from "../types";
import { EmptyState, Notice } from "../components/UI";
import { categories, errorMessage } from "../lib/marketplace";
import Recommendations from "../components/Recommendations";
import ServiceCard from "../components/ServiceCard";
import BookingDialog from "../components/BookingDialog";
import { useAuth } from "../context/auth";

const popular = ["Plumbing", "Cleaning", "Electrical"];
const popularCategories = categories.filter(item => [...popular, "Painting", "Gardening", "Beauty"].includes(item.name));
const bookingSteps = [
  { title: "Find a local provider", text: "Search by service and area, then compare prices and provider profiles.", icon: Search },
  { title: "Request a booking", text: "Choose an available date and time, then send your request to the provider.", icon: Handshake },
  { title: "Track your booking", text: "Check the latest status and manage appointments from your dashboard.", icon: ShieldCheck }
];
const initialFilters = {
  query: "", location: "", category: "", sort: "newest", minPrice: "", maxPrice: "",
  minRating: "", verified: false, availableDay: "", radius: "25"
};

function scrollToServices() { document.getElementById("services")?.scrollIntoView(); }

export default function Home() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<Service | null>(null);
  const [success, setSuccess] = useState(false);
  const [allCategories, setAllCategories] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState("");
  const { query, location, category, sort, minPrice, maxPrice, minRating, verified, availableDay, radius } = filters;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api.get<Service[]>("/services", { signal: controller.signal, params: {
        search: query || undefined, location: location || undefined, category: category || undefined, sort,
        minPrice: minPrice || undefined, maxPrice: maxPrice || undefined, minRating: minRating || undefined,
        verified: verified || undefined, availableDay: availableDay || undefined, ...(coords ? { ...coords, radius } : {})
      } }).then(({ data }) => {
        if (controller.signal.aborted) return;
        setServices(data);
        setError("");
      }).catch(err => {
        if (!controller.signal.aborted) setError(errorMessage(err, "Services are unavailable right now. Please try again."));
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [retry, query, location, category, sort, minPrice, maxPrice, minRating, verified, availableDay, coords, radius]);

  function changeFilter<Key extends keyof typeof initialFilters>(key: Key, value: (typeof initialFilters)[Key]) {
    setFilters(current => ({ ...current, [key]: value }));
  }
  function selectCategory(name: string) { changeFilter("category", name); scrollToServices(); }
  function reset() { setFilters(initialFilters); setCoords(null); setGeoError(""); }
  function locate() {
    if (!navigator.geolocation) { setGeoError("Location is unavailable in this browser. Search by area instead."); return; }
    navigator.geolocation.getCurrentPosition(position => {
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setGeoError("");
    }, () => setGeoError("Location access was unavailable. Search by area instead."), { timeout: 10000 });
  }

  const browsing = !query && !location && !category && !minPrice && !maxPrice && !minRating && !verified && !availableDay && !coords && sort === "newest";
  const featured = browsing ? services.filter((service, index) => services.findIndex(item => item.category === service.category) === index).slice(0, 3) : [];
  const remaining = services.filter(service => !featured.includes(service));

  return <main>
    <section className="hero"><div className="container hero-grid">
      <div className="hero-copy">
        <span className="hero-kicker"><MapPin size={16} /> LOCAL SERVICES ACROSS SOUTH AFRICA</span>
        <h1>Expert help.<br />Right in your <em>neighbourhood.</em></h1>
        <p>From everyday repairs to big makeovers, find skilled local professionals across South Africa.</p>
        <form className="search-bar" onSubmit={event => { event.preventDefault(); scrollToServices(); }}>
          <label className="search-field"><Search size={20} /><input type="search" aria-label="Search services" placeholder="What do you need help with?" value={query} onChange={event => changeFilter("query", event.target.value)} /></label>
          <label className="search-field location-field"><MapPin size={19} /><input type="search" aria-label="Search location" placeholder="Your area" value={location} onChange={event => changeFilter("location", event.target.value)} /></label>
          <button className="button" aria-label="Find services"><Search size={19} /><span>Search</span></button>
        </form>
        <div className="popular"><span>Popular</span>{popular.map(name => <button key={name} onClick={() => selectCategory(name)}>{name}</button>)}</div>
      </div>
      <div className="market-hero-art" aria-hidden="true">
        <img className="hero-photo" src={heroPhoto} alt="" fetchPriority="high" />
        <div className="hero-art-caption"><span><CalendarDays size={22} /></span><div><strong>Book local services</strong><small>Choose a time that suits you</small></div></div>
      </div>
    </div></section>

    <div className="trust-strip"><div className="container"><span><MapPin /> Proudly South African</span><span><Handshake /> Connecting local communities</span><span><ShieldCheck /> Secure account access</span></div></div>

    <section className="container section">
      <div className="section-heading"><h2>What can we help with?</h2><button className="text-button" onClick={() => { reset(); scrollToServices(); }}>Explore all services</button></div>
      <div className="category-grid">{(allCategories ? categories : popularCategories).map(({ name, icon: Icon, detail, color }) =>
        <button className={`category-card ${category === name ? "selected" : ""}`} key={name} aria-pressed={category === name} onClick={() => selectCategory(category === name ? "" : name)}>
          <span className={`category-icon ${color}`}><Icon size={27} /></span><strong>{name}</strong><span>{detail}</span>
        </button>)}</div>
      <button className="text-button" aria-expanded={allCategories} onClick={() => setAllCategories(value => !value)}>{allCategories ? "Show popular categories" : "Show all categories"}</button>
    </section>

    <section className="listing-section" id="services"><div className="container">
      <div className="section-heading">
        <div><h2>{category || "Discover local services"}</h2><p className="subtle">Compare services in your area.</p></div>
        <label className="sort-label"><SlidersHorizontal size={17} /><select aria-label="Sort services" value={sort} onChange={event => changeFilter("sort", event.target.value)}>
          <option value="newest">Newest first</option><option value="low">Lowest price first</option><option value="high">Highest price first</option>
          <option value="rating">Highest rated</option><option value="relevance">Relevance</option>{coords && <option value="distance">Nearest first</option>}
        </select></label>
      </div>
      <div className="directory-filters">
        <label>Area<input value={location} onChange={event => changeFilter("location", event.target.value)} placeholder="Any area" /></label>
        <label>Min price (R)<input type="number" min="0" value={minPrice} onChange={event => changeFilter("minPrice", event.target.value)} placeholder="Any" /></label>
        <label>Max price (R)<input type="number" min="0" value={maxPrice} onChange={event => changeFilter("maxPrice", event.target.value)} placeholder="Any" /></label>
        <label>Minimum rating<select value={minRating} onChange={event => changeFilter("minRating", event.target.value)}><option value="">Any rating</option>{[3, 4, 5].map(n => <option key={n} value={n}>{n}+ stars</option>)}</select></label>
        <label>Working day<select value={availableDay} onChange={event => changeFilter("availableDay", event.target.value)}><option value="">Any day</option>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
        <label className="checkbox-label"><input type="checkbox" checked={verified} onChange={event => changeFilter("verified", event.target.checked)} /> Verified only</label>
        <button className="button secondary small" onClick={locate}>{coords ? "Update my location" : "Use my location"}</button>
        {coords && <label>Radius (km)<select value={radius} onChange={event => changeFilter("radius", event.target.value)}>{[5, 10, 25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label>}
        <button className="text-button" onClick={reset}>Reset filters</button>
      </div>
      {coords && <p className="field-hint">Radius searches show listings with a mapped service location.</p>}
      {geoError && <Notice>{geoError}</Notice>}
      {success && <Notice success>Booking requested. <Link to="/dashboard">View my bookings</Link></Notice>}
      <div className="filter-row">
        {["", ...categories.map(item => item.name)].map(name => <button key={name} className={`filter ${category === name ? "active" : ""}`} aria-pressed={category === name} onClick={() => changeFilter("category", name)}>{name || "All services"}</button>)}
        {!loading && !error && <span className="result-count" aria-live="polite">{services.length} {services.length === 1 ? "service" : "services"}</span>}
      </div>
      {error ? <><Notice>{error}</Notice><button className="button secondary" onClick={() => { setLoading(true); setError(""); setRetry(value => value + 1); }}>Try again</button></> :
        loading ? <div className="service-grid" role="status" aria-label="Loading services">{[0, 1, 2].map(item => <div className="skeleton-card" key={item}><div /><span /><span /><span /></div>)}</div> :
        services.length ? <>
          {featured.length > 0 && <section className="featured-services" aria-labelledby="featured-title"><h3 id="featured-title">Featured services</h3><div className="service-grid">{featured.map(service => <ServiceCard key={service._id} service={service} onBook={setSelected} />)}</div></section>}
          {remaining.length > 0 && <section aria-label="Service results">{featured.length > 0 && <h3 className="more-services">More local services</h3>}<div className="service-grid">{remaining.map(service => <ServiceCard key={service._id} service={service} onBook={setSelected} />)}</div></section>}
        </> : <EmptyState title="No matching services">Try another category, price or area. <button className="text-button" onClick={reset}>Clear filters</button></EmptyState>}
      <details className="directory-recommendations" onToggle={event => setShowRecommendations(event.currentTarget.open)}>
        <summary>See provider recommendations</summary>
        {showRecommendations && <Recommendations category={category} location={location} />}
      </details>
    </div></section>

    <section className="container section" id="how-it-works">
      <div className="center-heading"><h2>How booking works</h2></div>
      <div className="steps">{bookingSteps.map(({ title, text, icon: Icon }) => <div className="step" key={title}><Icon size={28} /><h3>{title}</h3><p>{text}</p></div>)}</div>
    </section>
    <section className="container provider-banner">
      <div><h2>Offer your services on LocalTrustSA</h2><p>Publish your services and manage bookings in one place.</p></div>
      <Link className="button light" to={user ? "/dashboard" : "/register?role=provider"}>{user ? "Open dashboard" : "Become a provider"}</Link>
    </section>
    {selected && user?.role === "customer" && <BookingDialog service={selected} onClose={() => setSelected(null)} onSuccess={() => { setSelected(null); setSuccess(true); }} />}
  </main>;
}
