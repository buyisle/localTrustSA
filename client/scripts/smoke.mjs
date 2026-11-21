import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// Render the actual routes with isolated browser storage. No API data is replaced.
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", ssr: { external: ["react", "react-dom", "react-router-dom", "lucide-react", "axios"] } });
try {
  const { default: App } = await server.ssrLoadModule("/src/App.tsx");
  const { AuthContext } = await server.ssrLoadModule("/src/context/auth.ts");
  const { default: ServiceCard } = await server.ssrLoadModule("/src/components/ServiceCard.tsx");
  const { default: BookingActions } = await server.ssrLoadModule("/src/components/BookingActions.tsx");
  const render = path => renderToString(h(MemoryRouter, { initialEntries: [path] }, h(App)));

  assert.match(render("/"), /Right in your/);
  assert.match(render("/login"), /Welcome back/);
  assert.match(render("/register?role=provider"), /Offer my skills/);
  assert.match(render("/missing"), /Page not found/);
  storage.set("user", "invalid json");
  assert.match(render("/"), /Get started/);

  for (const role of ["customer", "provider"]) {
    const user = { id: "test-user", name: "Test User", email: "test@example.test", role };
    storage.set("token", "test-only-token");
    storage.set("user", JSON.stringify(user));
    const dashboard = render("/dashboard");
    assert.match(dashboard, role === "provider" ? /Customer bookings/ : /My bookings/);
    assert.equal(dashboard.includes("Publish a service"), role === "provider");
    assert.match(render("/"), /My dashboard/);
  }

  const actions = (status, provider, review) => renderToString(h(BookingActions, {
    booking: { _id: "test-booking", bookingDate: "2020-01-01T10:00:00Z", status, review }, provider, onChange() {},
  }));
  assert.match(actions("pending", true), /Accept booking/);
  assert.doesNotMatch(actions("pending", false), /Accept booking/);
  assert.match(actions("confirmed", true), /Mark completed/);
  assert.match(actions("confirmed", false), /Cancel booking/);
  assert.match(actions("completed", false), /Leave a review/);
  assert.doesNotMatch(actions("completed", true), /Leave a review/);
  assert.doesNotMatch(actions("cancelled", false), /Cancel booking/);
  assert.match(actions("completed", false, { rating: 5, comment: "Excellent service" }), /Excellent service/);
  assert.doesNotMatch(actions("completed", false, { rating: 5, comment: "Excellent service" }), /Leave a review/);
  console.log("PASS: role-specific booking controls, terminal states and reviewed bookings.");

  // Optional read-only integration checks use the running Express/MongoDB service.
  const apiBase = new URL("/api/", server.config.server.proxy["/api"]);
  try {
    const response = await fetch(new URL("services", apiBase), { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200);
    const services = await response.json();
    assert.ok(Array.isArray(services));
    for (const service of services) {
      assert.equal(typeof service._id, "string");
      assert.equal(typeof service.price, "number");
      assert.equal(typeof service.location, "string");
    }
    if (services.length) {
      for (const role of ["customer", "provider"]) {
        const card = renderToString(h(MemoryRouter, null, h(AuthContext.Provider, {
          value: { user: { role }, login() {}, logout() {} },
        }, h(ServiceCard, { service: services[0], onBook() {} }))));
        assert.equal(card.includes("Book now"), role === "customer");
        assert.ok(card.includes(services[0].title.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#x27;")));
      }
    }
    const bookings = await fetch(new URL("bookings/my", apiBase), { signal: AbortSignal.timeout(5000) });
    assert.equal(bookings.status, 401);
    console.log(`PASS: live API schema (${services.length} services), role-specific service actions, and protected bookings.`);
  } catch (error) {
    if (error instanceof TypeError || error.name === "TimeoutError") console.log("SKIP: live API is unavailable.");
    else throw error;
  }
  console.log("PASS: public routes, malformed storage, customer dashboard, and provider publishing access.");
  console.log("Rendering checks do not exercise browser interactions or submit database writes.");
} finally {
  await server.close();
  delete globalThis.localStorage;
}
