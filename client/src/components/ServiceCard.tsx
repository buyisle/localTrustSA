import { BadgeCheck, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import ServiceImage from "./ServiceImage";
import ProviderAvatar from "./ProviderAvatar";
import ServiceReviews from "./ServiceReviews";
import { categories, money } from "../lib/marketplace";
import { useAuth } from "../context/auth";
import type { Service } from "../types";

export default function ServiceCard({ service, onBook }: { service: Service; onBook: (service: Service) => void }) {
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const { user } = useAuth();
  const profile = `/services/${service._id}`;
  const color = categories.find(item => item.name === service.category)?.color || "teal";
  const rated = Boolean(service.reviewCount && service.rating);
  return <article className="service-card">
    <div className="service-media">
      <Link to={profile} aria-label={service.title}><ServiceImage category={service.category} image={service.image} /></Link>
      <span className={`category-tag ${color}`}>{service.category}</span>
    </div>
    <div className="service-body">
      <h3><Link to={profile}>{service.title}</Link></h3>
      <p className="meta"><MapPin size={16} />{service.location}</p>
      <p className="service-description">{service.description}</p>
      <div className="service-provider">
        <ProviderAvatar provider={service.provider} />
        <div><strong>{service.provider?.name || "Local provider"}</strong>
          {service.demo ? <small className="demo-label">Demo provider</small> : service.verified && <small className="verified-label"><BadgeCheck size={15} /> Verified provider</small>}
        </div>
      </div>
      {rated ? <button className="text-button service-reviews" onClick={() => setReviewsOpen(true)}><Star size={16} /> {service.rating?.toFixed(1)} ({service.reviewCount} {service.reviewCount === 1 ? "review" : "reviews"})</button> : <span className="service-reviews subtle">No reviews yet</span>}
      <div className="service-bottom">
        <div><span className="price">{money(service.price)}</span><span className="price-label">Service price</span></div>
        <div className="service-actions">
          <Link className="button small secondary" to={profile}>View profile</Link>
          {user?.role === "customer" ? <button className="button small" onClick={() => onBook(service)}>Book now</button> : !user && <Link className="button small" to={`/login?service=${service._id}`}>Log in to book</Link>}
        </div>
      </div>
    </div>
    {reviewsOpen && <ServiceReviews id={service._id} title={service.title} onClose={() => setReviewsOpen(false)} />}
  </article>;
}
