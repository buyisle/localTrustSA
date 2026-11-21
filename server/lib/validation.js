const categories = ["Plumbing", "Electrical", "Cleaning", "House Cleaning", "Painting", "Gardening", "Beauty", "Hairdressing", "Carpentry", "Appliance Repair", "Air Conditioning", "Handyman", "Pest Control", "Tiling", "Moving Services", "Car Washing"];
function serviceDetails(body) {
  if (body.coordinates !== undefined) {
    const point = body.coordinates;
    if (!point || point.type !== 'Point' || !Array.isArray(point.coordinates) || point.coordinates.length !== 2 || point.coordinates.some(value => typeof value !== 'number' || !Number.isFinite(value)) || Math.abs(point.coordinates[0]) > 180 || Math.abs(point.coordinates[1]) > 90) return false;
  }
  const { title, category, description, price, location } = body;
  return typeof title === "string" && title.trim().length > 0 && title.length <= 120 &&
    categories.includes(category) && typeof description === "string" && description.trim().length > 0 && description.length <= 3000 &&
    typeof location === "string" && location.trim().length > 0 && location.length <= 160 &&
    typeof price === "number" && Number.isFinite(price) && price >= 0 && price <= 1000000;
}
function canTransition(role, current, next) {
  const transitions = role === "provider"
    ? { pending: ["confirmed", "cancelled"], confirmed: ["completed", "cancelled"] }
    : role === "customer" ? { pending: ["cancelled"], confirmed: ["cancelled"] } : {};
  return (transitions[current] || []).includes(next);
}
module.exports = { categories, serviceDetails, canTransition };
