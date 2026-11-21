import { useEffect, useRef, useState } from "react";
import api from "../Services/api";
import { Loading, Notice } from "./UI";
import { errorMessage } from "../lib/marketplace";
interface Review { rating: number; comment: string; customer: string; createdAt: string }
export default function ServiceReviews({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    api.get<Review[]>(`/services/${id}/reviews`, { signal: controller.signal }).then(({ data }) => setReviews(data)).catch(err => { if (!controller.signal.aborted) setError(errorMessage(err, "Unable to load reviews.")); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);
  return <dialog ref={dialog} className="booking-dialog" aria-labelledby={`reviews-${id}`} onCancel={onClose}>
    <button className="icon-button dialog-close" onClick={onClose} aria-label="Close reviews">×</button><h2 id={`reviews-${id}`}>{title}</h2><p className="subtle">Customer reviews from completed bookings</p>
    {loading ? <Loading text="Loading reviews…" /> : error ? <Notice>{error}</Notice> : reviews.length ? reviews.map((review, index) => <blockquote className="review-quote" key={index}><strong>{review.rating} / 5 · {review.customer}</strong><p>{review.comment}</p><small>{new Date(review.createdAt).toLocaleDateString("en-ZA")}</small></blockquote>) : <p>No reviews yet.</p>}
  </dialog>;
}
