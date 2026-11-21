# Local Trust SA frontend

Responsive React, TypeScript, Vite and Tailwind marketplace. The frontend continues to use `src/Services/api.js` and the existing Express/MongoDB API; no sample listings or payment features are included.

## Run

From `client`:

```sh
npm install
npm run dev
```

Start the existing backend separately. Open `http://localhost:5174` for the frontend. Axios uses the relative `/api` base URL and Vite forwards `/api` and `/uploads` to `http://localhost:5001`.

## Pages and components

- `/`: marketplace, service/location search, category filters, price sorting and booking dialog.
- `/login` and `/register`: shared authentication form; registration supports customer and provider roles. `/register?role=provider` selects the provider option.
- `/dashboard`: authenticated booking dashboard. Providers also receive a service publishing form.
- `src/context/`: shared session state backed by the existing JWT and user localStorage entries.
- `src/components/`: shared navigation, footer, service cards, accessible native booking dialog and feedback states.
- `src/lib/marketplace.ts`: category metadata, currency formatting and API error messages.
- `src/index.css`: responsive navy, teal and white design, mobile navigation and reduced-motion support.

## Verification

```sh
npm run build
npm run lint
npm run test:smoke
```

The smoke checks render the actual routes for both roles and validate malformed session storage. When the backend is running, they also validate live service response fields, role-specific booking buttons and unauthenticated booking protection. They perform no database writes and require no extra packages.

These checks do not replace browser testing. Manually check registration, login, logout, customer bookings with a future local date, provider publishing, and booking visibility for each account. Review at mobile, tablet and desktop widths.

## Existing API contracts

- `POST /auth/register` and `POST /auth/login` return `{ token, user }`.
- `GET /services` returns marketplace listings.
- `POST /services` publishes provider services, with a numeric ZAR price.
- `POST /bookings` accepts `{ serviceId, bookingDate }`, with an ISO date.
- `GET /bookings/my` returns bookings for the authenticated customer or provider.

Booking status controls, provider listing management, and completed-booking reviews are implemented. See the root README for the current API contracts, setup, demo seed, test limitations and presentation walkthrough.
