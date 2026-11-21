# API additions

All paths start `/api`. Protected paths require `Authorization: Bearer <token>`. Existing auth and booking API paths remain supported. Dates must include `Z` or an explicit offset and be future instants at minute precision; use `2026-12-01T10:00:00+02:00` for 10:00 SAST, or its UTC equivalent.

| Method | Path | Purpose / access |
| --- | --- | --- |
| GET | `/services` | Public directory. Params: search, category, location, minPrice, maxPrice, minRating (0-5), verified=true, availableDay (0=Sun), lat, lng, radius (km, up to 500), sort (newest/low/high/rating/distance/relevance). Radius needs coordinates; distance sort requires them. Max 100 results. |
| GET | `/services/:id` | Public active service/provider profile, safe fields only |
| GET | `/services/:id/reviews` | Up to 50 approved or legacy non-DEMO completed-booking reviews across that provider's services |
| POST | `/services` | Provider listing; existing fields plus optional GeoJSON coordinates |
| PATCH | `/services/:id` | Owning provider edits existing service and optional GeoJSON coordinates |
| POST | `/bookings` | Customer; serviceId, bookingDate, optional photos (up to three base64 JPEG/PNG/WebP images of up to 1 MB each); pending one-hour reservation |
| GET | `/bookings/my` | Owner history with timeline, proposal, review and payment data |
| GET | `/bookings/:id/photos/:filename` | Private image for the booking's customer or assigned provider |
| GET | `/bookings/:id/email-preview/:eventId` | Owning customer; renders the selected booking update in preview mode |
| POST | `/bookings/:id/demo-payment` | Owning customer, confirmed or completed booking with an agreed price. Accepts only `method: "demo-card"` or `method: "demo-eft"`. Returns the existing confirmation on replay. |
| POST | `/bookings/:id/demo-payment/receipt` | Owning customer. Claims pending or failed receipt delivery and returns the current confirmation and receipt status. |
| GET | `/bookings/:id/demo-payment/receipt-preview` | Owning customer. Returns receipt HTML when the receipt was processed in preview mode. |
| PATCH | `/bookings/:id/status` | Customer/provider permitted status transitions |
| POST | `/bookings/:id/review` | Owning customer, completed booking, rating and comment, once; pending moderation |
| GET | `/marketplace/recommendations` | Public deterministic Top-5; category/location/lat/lng/radius plus optional date. Returns method, recommendations with providerId/serviceId/rank/score/explanation/service |
| POST | `/marketplace/assistant` | AI support, optionally authenticated. Accepts `message` (up to 2,000 characters), optional `location`, and up to four `history` turns with `role` and `text`. Returns `mode`, `reply`, and when relevant `services` or the authenticated customer's `bookings`. Returns 429 with `Retry-After` for usage limits and 503 with navigation guidance when unavailable. |
| GET | `/marketplace/assistant/bookings` | Authenticated own latest five appointments |
| GET/PATCH | `/marketplace/profile` | Own name/location; providers may set biography, experience and availability.days/startHour/endHour (SAST) |
| POST | `/marketplace/portfolio` | Provider uploads base64 data and caption; max 1 MB, JPEG/PNG/WebP signature validation, up to 12 public photos |
| DELETE | `/marketplace/portfolio/:filename` | Provider removes only their own portfolio photo and generated local file |
| PATCH | `/marketplace/portfolio/profile-photo` | Provider selects an owned portfolio photo using its `url` |
| GET/POST | `/messages` | Own inbox, or customer starts/reuses a conversation with a `provider` ID |
| GET/POST | `/messages/:id` | Participants read up to 50 messages using optional `before` cursor, or send `text` of up to 2,000 characters |
| GET | `/marketplace/notifications` | Own latest 100 timeline notifications, read state |
| PATCH | `/marketplace/notifications/:id/read` | Mark only caller's notification read |
| POST | `/marketplace/appointments/:bookingId/reschedule` | Owning provider proposes future bookingDate |
| POST | `/marketplace/appointments/:bookingId/reschedule-response` | Owning customer responds accept boolean; availability/conflicts rechecked |
| POST | `/marketplace/appointments/:bookingId/payment` | Participant cash recording. Only the provider can record cash paid after completion. Previously paid simulations can be replayed for compatibility. |
| GET | `/marketplace/appointments/:bookingId/receipt` | Participant; paid receipt, simulation flag, currency, amount and reference |
| POST | `/marketplace/appointments/:bookingId/dispute` | Participant sends reason (up to 2000 chars) |
| GET | `/marketplace/admin/overview` | Admin-only users, bookings/payments, review queue, disputes and audit; 100 records per section |
| PATCH | `/marketplace/admin/users/:id` | Admin changes active/suspended/verified booleans. No role escalation; no DEMO verification; admin accounts protected |
| PATCH | `/marketplace/admin/reviews/:id` | Admin moderation=pending/approved/rejected; retains original text, appends event |
| PATCH | `/marketplace/admin/disputes/:id` | Admin resolution, marks resolved, audit |

GeoJSON example: `{"type":"Point","coordinates":[28.3698,-26.1885]}` (longitude first).

Demo confirmations are saved on the booking under `demoPayment` with a deterministic `DEMO-<booking ID>` reference, agreed ZAR amount, method and confirmation timestamp. Cash remains under `payment` with `CASH-...` references. Existing `SIM-...` receipts remain readable. Demo checkout requires an agreed price and accepts only the simulated method identifier.

### Appointment availability

`GET /api/bookings/availability/:serviceId?day=YYYY-MM-DD` returns `{ slots: string[] }` for a South African calendar date. The ISO timestamps represent half-hour start times for one-hour visits. The endpoint excludes elapsed times, times outside provider hours and overlaps with pending or confirmed reservations across the provider's services. It exposes only timestamps. Booking submission rechecks availability and concurrent reservations.
