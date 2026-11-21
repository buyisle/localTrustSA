const { test, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const bookingPhotos = require("../lib/bookingPhotos");
const { Conversation, Message } = require("../models/Conversation");
const { canTransition, serviceDetails } = require("../lib/validation");
process.env.JWT_SECRET = "test-secret-only-never-use-in-production";
const app = require("../Server");
const customer = "111111111111111111111111";
const provider = "222222222222222222222222";
const id = "333333333333333333333333";
let server, base;
before(async () => { server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve)); base = `http://127.0.0.1:${server.address().port}/api`; });
after(() => new Promise(resolve => server.close(resolve)));
afterEach(() => mock.restoreAll());
function auth(role = "customer") {
  const _id = role === "provider" ? provider : customer;
  mock.method(User, "findById", async () => ({ _id, role }));
  return { Authorization: `Bearer ${jwt.sign({ id: _id }, process.env.JWT_SECRET)}`, "Content-Type": "application/json" };
}
async function request(path, headers, body, method = "POST") {
  return fetch(base + path, { method, headers, body: JSON.stringify(body) });
}

test("booking photos are validated, stored privately, and served only to the assigned participants", async t => {
  const headers = auth();
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==";
  assert.equal((await request("/bookings", headers, { photos: [png, png, png, png] })).status, 400);
  assert.equal((await request("/bookings", headers, { photos: ["bm90IGFuIGltYWdl"] })).status, 400);
  mock.method(Service, "findById", async () => ({ _id: id, provider, price: 450 }));
  User.findById.mock.mockImplementation(async key => String(key) === provider ? { _id: provider, role: "provider" } : { _id: key, role: "customer" });
  mock.method(Booking, "exists", async filter => filter.photos && (filter.customer === customer || filter.provider === provider));
  mock.method(Booking, "create", async fields => ({ ...fields, _id: id }));
  const created = await request("/bookings", headers, { serviceId: id, bookingDate: "2099-01-01T10:00:00Z", photos: [png] });
  assert.equal(created.status, 201);
  const { booking } = await created.json();
  t.after(() => bookingPhotos.remove(booking.photos));
  const photo = "/bookings/" + id + "/photos/" + booking.photos[0];
  const customerPhoto = await fetch(base + photo, { headers });
  assert.equal(customerPhoto.status, 200);
  assert.equal(customerPhoto.headers.get("cache-control"), "no-store");
  assert.deepEqual(Buffer.from(await customerPhoto.arrayBuffer()), Buffer.from(png, "base64"));
  const providerToken = jwt.sign({ id: provider }, process.env.JWT_SECRET);
  assert.equal((await fetch(base + photo, { headers: { Authorization: "Bearer " + providerToken } })).status, 200);
  const stranger = jwt.sign({ id }, process.env.JWT_SECRET);
  assert.equal((await fetch(base + photo, { headers: { Authorization: "Bearer " + stranger } })).status, 404);
  assert.equal((await fetch(base + photo)).status, 401);
  const publicPath = await fetch(base.replace(/\/api$/, "") + "/uploads/" + booking.photos[0]);
  assert.doesNotMatch(publicPath.headers.get("content-type") || "", /^image\//);
});

test("messaging reuses a customer-provider thread and enforces participant access in both directions", async () => {
  const headers = auth();
  User.findById.mock.mockImplementation(async key => ({ _id: key, role: key === provider ? "provider" : "customer" }));
  mock.method(User, "exists", async () => true);
  const upsert = mock.method(Conversation, "findOneAndUpdate", async () => ({ _id: id }));
  const created = await request("/messages", headers, { provider, customer: id });
  assert.equal((await created.json())._id, id);
  assert.deepEqual(upsert.mock.calls[0].arguments[0], { customer, provider });
  mock.method(Conversation, "exists", async filter => filter.customer === customer || filter.provider === provider);
  mock.method(Conversation, "updateOne", async () => {});
  const replies = [];
  mock.method(Message, "create", async fields => {
    const message = { ...fields, _id: String(replies.length), createdAt: new Date() };
    replies.unshift(message);
    return message;
  });
  mock.method(Message, "find", () => ({ select() { return this; }, sort() { return this; }, limit: async () => replies }));
  const path = "/messages/" + id;
  const providerHeaders = { ...headers, Authorization: "Bearer " + jwt.sign({ id: provider }, process.env.JWT_SECRET) };
  assert.equal((await request(path, headers, { text: "Is the service available?" })).status, 201);
  assert.equal((await request(path, providerHeaders, { text: "Please check my listed hours." })).status, 201);
  assert.equal((await request(path, headers, { text: " " })).status, 400);
  const history = await (await fetch(base + path, { headers })).json();
  assert.deepEqual(history.messages.map(message => message.sender), [customer, provider]);
  const stranger = { ...headers, Authorization: "Bearer " + jwt.sign({ id }, process.env.JWT_SECRET) };
  assert.equal((await fetch(base + path, { headers: stranger })).status, 404);
  assert.equal((await request(path, stranger, { text: "Let me in" })).status, 404);
});
test("health, unknown routes and unauthenticated bookings", async () => {
  assert.equal((await fetch(base + "/health")).status, 200);
  assert.equal((await fetch(base + "/missing")).status, 404);
  assert.equal((await fetch(base + "/bookings/my")).status, 401);
});
test("malformed JSON returns a usable client error", async () => {
  const response = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, "Invalid JSON body");
});
test("registration rejects blank names, invalid emails and privileged roles", async () => {
  for (const fields of [{ name: " " }, { email: "invalid" }, { role: "admin" }, { password: "short" }]) {
    const response = await request("/auth/register", { "Content-Type": "application/json" }, { name: "Test", email: "test@example.test", password: "test-password", ...fields });
    assert.equal(response.status, 400);
  }
});
test("booking status transition matrix protects terminal states and customer powers", () => {
  for (const role of ["provider", "customer", "admin"]) for (const current of ["pending", "confirmed", "completed", "cancelled"]) for (const next of ["pending", "confirmed", "completed", "cancelled"]) {
    const expected = role === "provider" && ((current === "pending" && ["confirmed", "cancelled"].includes(next)) || (current === "confirmed" && ["completed", "cancelled"].includes(next))) || role === "customer" && ["pending", "confirmed"].includes(current) && next === "cancelled";
    assert.equal(canTransition(role, current, next), expected, `${role}: ${current} -> ${next}`);
  }
});
test("service validation rejects unknown categories, overflow and blank details", () => {
  const valid = { title: "Cleaning", category: "Cleaning", description: "Home clean", price: 350, location: "Soweto" };
  assert.equal(serviceDetails(valid), true);
  for (const fields of [{ price: -1 }, { price: Infinity }, { title: " " }, { category: "invalid" }, { description: "x".repeat(3001) }]) assert.equal(serviceDetails({ ...valid, ...fields }), false);
});
test("booking creation snapshots price and rejects paused services", async () => {
  const headers = auth();
  mock.method(Service, "findById", async () => ({ _id: id, provider, price: 350, active: true }));
  User.findById.mock.mockImplementation(async key => ({ _id: key, role: String(key) === provider ? "provider" : "customer" }));
  mock.method(Booking, "exists", async () => false);
  const create = mock.method(Booking, "create", async body => body);
  const response = await request("/bookings", headers, { serviceId: id, bookingDate: "2099-01-01T10:00:00Z" });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).booking.agreedPrice, 350);
  assert.equal(create.mock.calls[0].arguments[0].customer, customer);
  Service.findById.mock.mockImplementation(async () => ({ active: false }));
  assert.equal((await request("/bookings", headers, { serviceId: id, bookingDate: "2099-01-01" })).status, 404);
});
test("day availability uses provider hours, blocks overlapping starts and exposes only slot timestamps", async () => {
  const day = "2099-01-02";
  const reservedAt = new Date(day + "T09:00:00+02:00");
  mock.method(Service, "findById", async () => ({ _id: id, provider, active: true }));
  mock.method(User, "findById", () => ({ select: async () => ({ role: "provider", availability: {
    days: [reservedAt.getUTCDay()], startHour: 8, endHour: 11
  } }) }));
  const bookings = mock.method(Booking, "find", () => ({
    select: () => ({ lean: async () => [{ bookingDate: reservedAt, customer: "private" }] })
  }));
  const url = base + "/bookings/availability/" + id;
  assert.equal((await fetch(url + "?day=2099-02-30")).status, 400);
  assert.equal((await fetch(url + "?day=2000-01-02")).status, 400);
  const response = await fetch(url + "?day=" + day);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { slots: [day + "T06:00:00.000Z", day + "T08:00:00.000Z"] });
  assert.deepEqual(bookings.mock.calls[0].arguments[0].status, { $in: ["pending", "confirmed"] });
  assert.equal(bookings.mock.calls[0].arguments[0].provider, provider);
});
test("customers cannot publish or edit listings", async () => {
  const headers = auth();
  assert.equal((await request("/services", headers, {})).status, 403);
  assert.equal((await request(`/services/${id}`, headers, {}, "PATCH")).status, 403);
});
test("provider acceptance uses ownership and optimistic concurrency", async () => {
  const headers = auth("provider");
  mock.method(Booking, "findById", async () => ({ _id: id, customer, provider, status: "pending" }));
  const update = mock.method(Booking, "findOneAndUpdate", async () => ({ status: "confirmed" }));
  assert.equal((await request(`/bookings/${id}/status`, headers, { status: "confirmed" }, "PATCH")).status, 200);
  assert.deepEqual(update.mock.calls[0].arguments[0], { _id: id, status: "pending" });
  Booking.findById.mock.mockImplementation(async () => ({ provider: customer, status: "pending" }));
  assert.equal((await request(`/bookings/${id}/status`, headers, { status: "confirmed" }, "PATCH")).status, 403);
});
test("future bookings cannot complete and concurrent updates return conflict", async () => {
  const headers = auth("provider");
  mock.method(Booking, "findById", async () => ({ _id: id, provider, status: "confirmed", bookingDate: new Date("2099-01-01") }));
  assert.equal((await request(`/bookings/${id}/status`, headers, { status: "completed" }, "PATCH")).status, 409);
  mock.method(Booking, "findOneAndUpdate", async () => null);
  assert.equal((await request(`/bookings/${id}/status`, headers, { status: "cancelled" }, "PATCH")).status, 409);
});
test("reviews require valid rating and one owned completed booking", async () => {
  const headers = auth();
  assert.equal((await request(`/bookings/${id}/review`, headers, { rating: 6, comment: "Great" })).status, 400);
  const update = mock.method(Booking, "findOneAndUpdate", async () => ({ review: { rating: 5, comment: "Great" } }));
  assert.equal((await request(`/bookings/${id}/review`, headers, { rating: 5, comment: "Great" })).status, 201);
  assert.deepEqual(update.mock.calls[0].arguments[0], { _id: id, customer, status: "completed", review: { $exists: false } });
  Booking.findOneAndUpdate.mock.mockImplementation(async () => null);
  assert.equal((await request(`/bookings/${id}/review`, headers, { rating: 5, comment: "Again" })).status, 409);
});
test("listing updates constrain ownership and ignore injected provider fields", async () => {
  const headers = auth("provider");
  const details = { title: "Clean home", category: "Cleaning", description: "Full home clean", price: 400, location: "Pretoria", active: false, provider: customer };
  const update = mock.method(Service, "findOneAndUpdate", async () => ({ ...details, provider }));
  assert.equal((await request(`/services/${id}`, headers, details, "PATCH")).status, 200);
  assert.deepEqual(update.mock.calls[0].arguments[0], { _id: id, provider });
  assert.equal(Object.hasOwn(update.mock.calls[0].arguments[1].$set, "provider"), false);
  Service.findOneAndUpdate.mock.mockImplementation(async () => null);
  assert.equal((await request(`/services/${id}`, headers, details, "PATCH")).status, 404);
});
test("invalid booking IDs and past dates produce client errors", async () => {
  const headers = auth();
  assert.equal((await request("/bookings", headers, { serviceId: "invalid", bookingDate: "2099-01-01" })).status, 400);
  mock.method(Service, "findById", async () => ({ _id: id, provider, price: 300 }));
  for (const bookingDate of ["invalid", "2020-01-01", null]) assert.equal((await request("/bookings", headers, { serviceId: id, bookingDate })).status, 400);
});

