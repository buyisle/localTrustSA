# Local Trust SA

An incremental upgrade of the existing React/Vite/TypeScript, Express and MongoDB marketplace. Existing authentication, booking routes, collections and saved records are preserved. No deployment or real payment processing is included.

## Run

Requires Node.js 22.12+ and MongoDB 6+ (the booking reservation index uses a partial filter with `$in`).

```powershell
npm run setup
npm run dev:server
# In a second terminal:
npm run dev:client
```

Keep the existing `server/.env`. If setting up a new checkout, copy `.env.example` only if `.env` does not already exist, then configure `MONGO_URI` and `JWT_SECRET`. Do not commit secrets. Production requires a JWT secret of at least 32 characters. Vite runs on port 5174 and proxies `/api` to port 5001; use `VITE_API_URL` and `CLIENT_ORIGIN` for separate hosting.

For a local single-server preview, run `npm run build`, restart Express with `npm start`, then open http://localhost:5001. Restart an already running backend to load the new routes and schemas. This does not reset MongoDB. Startup waits for the additive booking reservation index; an index failure prevents startup rather than serving unprotected reservations. No `syncIndexes`, drop, delete or destructive migration runs.

### Try the AI assistant

1. For live responses, add `OPENAI_API_KEY` to `server/.env` and restart Express. Chat messages sent with a configured key can incur OpenAI charges.
2. Open http://localhost:5174 with both dev servers running, or http://localhost:5001 after building and starting Express. Select **Ask LocalTrust** in the bottom-right corner.
3. Send **My kitchen sink is leaking. Who can help me?** Then send **Johannesburg**. Matching public listings open their service details page. Try an area you know has listings if Johannesburg returns no matches.
4. Ask **What does pending confirmation mean?** and **How do simulated card and EFT receipts work?** Sign in as a customer and select **Check my bookings** or ask **Show my bookings** to see your recent appointments.
5. Use **Clear conversation** to reset the chat. To check the fallback, start Express without the OpenAI key and send a message. Directory and account links appear below the error.

The assistant uses `gpt-4.1-mini`, up to four recent turns, an eight-second OpenAI timeout, and 400 output tokens per request. Each Express process limits requests to six per minute per IP and signed-in account, with daily caps of 60 per IP, 30 per account and 500 overall. Guest limits are shared by visitors on the same IP. The counters reset on restart and at UTC day boundaries. Booking records and listing details stay in Express and React. Follow-up requests can include the previous result summary. If the key is absent or the model is unavailable, recognized service questions and simple area follow-ups use a labelled directory search. Automated checks mock OpenAI.

## Implemented journeys

- Customer/provider registration, bcrypt passwords, JWT login, account suspension enforcement and private resource ownership. Admin registration remains forbidden.
- Navy and teal marketplace with a photographic hero, category browsing, featured services, provider cards, booking summaries and responsive customer/provider workspaces.
- MongoDB directory filtering by keyword, category, area, price, minimum approved-review rating, verified status, working day and distance/radius. Sort by price, rating, distance, relevance or recency. Browser location permission is optional. Radius searches exclude listings without coordinates; providers can map existing listings from My services. Results are currently capped at 100.
- Identical offers from the same provider appear once in the directory when the copies have no public reviews. Every original record remains available through its direct link and the provider workspace. Offers with different public details or their own review history remain distinct.
- Future-only bookings in Africa/Johannesburg, independent of browser/server timezone. The date picker queries live half-hour start times; submission revalidates and displays a pending confirmation screen. API rejects ambiguous timezone-free inputs, invalid calendar dates and past instants, requires active services/providers and enforces configured working hours.
- One-hour reservations: overlapping pending/confirmed jobs conflict across all services of a provider. Application queries check old saved bookings, while a unique multikey reservation index protects concurrent new bookings. Cancelled/completed bookings release their reservation through the partial index. Existing records are not backfilled or rewritten.
- Customer/provider dashboard counts from actual records; acceptance, decline/cancellation, completion, proposal of another date, customer acceptance/rejection, timeline and ownership checks. Old bookings without timelines display their known current status honestly.
- Cash after service and provider-only cash receipt recording after completion. Customer demo checkout offers simulated card and EFT, with a separate confirmation, stable reference and email receipt. Demo payments are excluded from cash earnings and require no financial credentials.
- One review per owned completed booking, 1-5 rating validation, pending moderation, approved public reviews and rating aggregates. Legacy reviews without a moderation field remain visible, except DEMO account feedback, which is excluded from public testimonials and ratings. New demo fixtures create no reviews.
- Explainable review-risk baseline (short text, external links, repetition, all-capitals). Signals queue human moderation, never automatic deletion. This is not a trained fraud detector.
- In-app booking/payment/reschedule/review notifications with per-user read state. Notifications are derived from booking timeline events, so they remain available with the recorded change. Optional authenticated HTTPS email delivery adapter worker is described below.
- Provider profile/working-hours editing and service listing management. Public profiles expose display names, optional provider-supplied HTTPS profile photos, service details, portfolio and working hours. Booking details remain limited to the relevant account or authorised admin.
- Deterministic Top-5 recommendations with provider ID, rank, score, service and explanation. Signals: category, distance when supplied, configured availability, actual conflicts for a supplied date, verification, approved ratings and relevant completed bookings. UI displays the leading three. No trained-model or measured-accuracy claim.
- LocalTrust Assistant with AI support, suggested questions, MongoDB listing cards, read-only booking assistance and DEMO checkout guidance. React renders responses as plain text and links. The OpenAI key stays in Express.
- Strict admin overview for users/providers, bookings/payment statuses, human review moderation, suspicious-review signals, disputes and audit records. Account status changes, moderation and dispute resolutions are logged. Admin lists currently show up to 100 records per section. Existing administrators use normal login; no public admin provisioning endpoint is added.

## Safe demo data

The script prepares 16 labelled DEMO services across 16 categories and eight Gauteng locations. It creates fictional provider accounts with random passwords that are not printed. It never deletes records, overwrites existing fields/passwords, creates bookings/testimonials or verifies a fictional business. Stable demo keys make listing upserts repeatable. Existing fixtures from earlier seed runs are retained. Register separate customer/provider accounts to demonstrate login; seeded provider accounts are catalogue fixtures, not shared login credentials.

Only run after explicitly confirming a development database. The selected name must include `dev`, `test`, `demo` or `local` and exactly match the name in `MONGO_URI`.

```powershell
$env:NODE_ENV = 'development'
$env:SEED_DATABASE_NAME = 'localtrust_demo' # Must match your development MONGO_URI
npm run seed
```

Do not change a production connection's environment label to bypass the guard. The script was tested with mocked persistence and was NOT run against the application's existing database in this session.

## Photography

The homepage uses a locally bundled generated editorial image. Service cards use bundled category photographs generated for the marketplace, with icon artwork for categories without a photo. See [image sources and the optional downloader](docs/IMAGES.md).

Providers can upload and remove up to 12 public portfolio photos (JPEG/PNG/WebP, 1 MB each) from their dashboard and select one as their profile picture. Add the biography and skills under **Profile & availability**. Public profiles use the marketplace category image and provider initials as fallbacks.

Customers can attach up to three private problem photos (JPEG/PNG/WebP, 1 MB each) during booking. The customer and assigned provider open them under **Problem photos** in the dashboard. Portfolio files live in `server/uploads` and private booking files live in `server/private-uploads/bookings`. Back up both directories alongside MongoDB. Production multi-instance hosting needs shared storage.

For messaging, select **Message provider** on a service page. Both participants can reply from **Messages** and use **Refresh** to retrieve new replies. For reviews, the provider marks an elapsed confirmed appointment complete, the customer submits one review, and an administrator approves it for public display. The customer's dashboard shows the submission while it awaits moderation.

## Booking email updates

Booking requests, confirmations, cancellations and completions default to in-app previews. In the customer dashboard, open **Booking email previews** on a booking created or updated after this change. Set `BOOKING_EMAIL_MODE=smtp` and configure the `DEMO_SMTP_*` settings below to enable real delivery for booking updates. Delivery is attempted after a saved booking event and claimed once per customer and event. Booking state is independent of SMTP. The DEMO receipt continues to use its own configuration.

## Demo payment and receipt email

Set these values in `server/.env`.

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | Connection string for an isolated development or presentation database |
| `JWT_SECRET` | Server-only signing secret for customer and provider sign-in |
| `DEMO_RECEIPT_MODE` | `preview` displays the HTML receipt in the dashboard with zero outbound email. Unset leaves delivery disabled. `smtp` enables external delivery. |
| `DEMO_SMTP_HOST` | Your approved provider's SMTP host |
| `DEMO_SMTP_PORT` | `587` for required STARTTLS (default) or `465` for implicit TLS |
| `DEMO_SMTP_USER` and `DEMO_SMTP_PASS` | Provider SMTP credentials. Keep them in server-side secrets or an untracked local environment file. |
| `DEMO_SMTP_FROM` | Single email address verified with your SMTP provider |

For the university presentation, use `DEMO_RECEIPT_MODE=preview` and restart the server. Sign in to a test customer account, book a service, and confirm the appointment from its provider account. In **My bookings**, open **DEMO checkout**, choose simulated card or EFT, and confirm. Show the ZAR amount, booking and transaction references, and the **No real money was transferred** label. Open **Preview receipt email** to show the HTML. Refresh the dashboard and reopen the confirmation to show that the reference and timestamp persisted.

Set `DEMO_RECEIPT_MODE=smtp` only after external delivery is authorized. Use a fresh booking to test SMTP because preview is a completed receipt state. The server takes the recipient from the authenticated customer's registered email. SMTP acceptance means the provider accepted the message for delivery. A definitively failed receipt can be retried from the confirmation without recording another payment. For an interrupted or ambiguous SMTP submission, check the provider's logs using the transaction reference before attempting recovery. Automatic resubmission is blocked in those cases to prevent duplicate receipts.

## Optional email adapter

Set `EMAIL_WEBHOOK_URL` to a trusted HTTPS email-delivery adapter and `EMAIL_WEBHOOK_TOKEN` to its server-only token. Then schedule `npm run notifications:email` yourself. It scans timeline events from the last seven days, skips DEMO and suspended/inactive recipients, leases delivery records and submits notifications with `Idempotency-Key`. The receiving adapter must enforce that key to deduplicate retries. Configure actual SMTP/mail-provider delivery in the adapter. Successful submission means the adapter accepted a job, not proof of inbox delivery. No external messages were sent while developing/testing this feature.

## Verification

```powershell
npm test
npm run build
npm run test:browser
```

Backend tests use real HTTP requests with isolated mocked persistence. Frontend smoke tests render actual routes; optional checks against port 5001 are read-only and may exercise an older running backend. The browser harness starts isolated Vite on an available port and launches local headless Chrome/Edge, intercepts API traffic with clearly marked fixtures, and writes screenshots to `.qa`. It checks desktop/mobile widths, past-date rejection, an America/Los_Angeles browser timezone with correct SAST booking submission, provider acceptance, simulated payment and role-specific pages. It never writes live MongoDB or invokes paid providers.

To exercise the full flow against your development database:

1. Register a provider, set working days and hours, and publish a service from the provider dashboard.
2. In a separate browser profile, register a customer. Use the category, area and price filters to find the listing, open the profile and request an available appointment.
3. Check that the appointment is pending on the customer dashboard, then accept it from the provider dashboard. Refresh the customer's dashboard to check that it is confirmed.
4. Open a second booking request for the same provider and date to check that the reserved time has disappeared. Cancel the original booking and check that the time is offered again if it is still in the future.
5. Try a suggested question in Ask LocalTrust, then use **Check my bookings** from the customer account.

A separate opt-in real MongoDB test verifies unique-index concurrency and aggregate/geospatial queries. Use a disposable test database explicitly:

```powershell
$env:NODE_ENV = 'test'
$env:MONGO_TEST_URI = 'mongodb://127.0.0.1:27017/localtrust_test_marketplace'
$env:MONGO_TEST_DATABASE = 'localtrust_test_marketplace'
npm --prefix server test
```

It never uses `MONGO_URI`, and only allows the confirmed `localtrust_test_*` database. New records remain labelled TEST; the test does not delete saved records or drop databases. Without these variables, the persistence test is explicitly skipped. Actual MongoDB concurrency/geospatial behavior remains unverified in this session.

See [quality/evaluation plan](docs/EVALUATION.md) and [API reference](docs/API.md).

## Remaining production work

Remaining production work includes broader persistence tests, shared image storage, automated booking-email recovery after process interruptions, and operational monitoring. The checkout remains a simulation.
