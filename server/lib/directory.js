const { categories } = require('./validation');
const escape = value => String(value).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function directoryPipeline(query = {}) {
  const match = { active: { $ne: false } };
  const stages = [];
  if (query.category) {
    if (!categories.includes(query.category)) throw Error('Choose a valid service category.');
    match.category = query.category;
  }
  if (query.search) match.$or = ['title','description','category'].map(field => ({ [field]: { $regex: escape(query.search), $options: 'i' } }));
  if (query.location) match.location = { $regex: escape(query.location), $options: 'i' };
  for (const key of ['minPrice','maxPrice','minRating','lat','lng','radius']) if (query[key] !== undefined && (query[key] === '' || !Number.isFinite(Number(query[key])))) throw Error('Enter valid numeric filters.');
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    match.price = {};
    if (query.minPrice !== undefined) match.price.$gte = Math.max(0, Number(query.minPrice));
    if (query.maxPrice !== undefined) match.price.$lte = Math.max(0, Number(query.maxPrice));
  }
  if (query.lat !== undefined || query.lng !== undefined || query.sort === 'distance') {
    const lat = Number(query.lat), lng = Number(query.lng), radius = Number(query.radius || 25);
    if (query.lat === undefined || query.lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180 || radius <= 0 || radius > 500) throw Error('Provide valid coordinates and a radius between 1 and 500 km.');
    stages.push({ $geoNear: { near: { type: 'Point', coordinates: [lng, lat] }, key: 'coordinates', distanceField: 'distance', maxDistance: radius * 1000, spherical: true, query: match } });
  } else stages.push({ $match: match });
  stages.push(
    { $lookup: { from: 'users', localField: 'provider', foreignField: '_id', as: 'owner' } },
    { $unwind: '$owner' },
    { $match: { 'owner.role': 'provider', 'owner.active': { $ne: false }, 'owner.suspended': { $ne: true } } },
    { $lookup: { from: 'bookings', localField: 'provider', foreignField: 'provider', let: { serviceId: '$_id' }, pipeline: [
      { $match: { status: 'completed', 'review.rating': { $exists: true }, 'review.moderation': { $in: ['approved', null] } } },
      { $lookup: { from: 'users', localField: 'customer', foreignField: '_id', as: 'reviewer' } },
      { $match: { 'reviewer.demo': { $ne: true }, 'reviewer.email': { $not: /@demo\.localtrust\.test$/i } } },
      { $group: { _id: null, rating: { $avg: '$review.rating' }, reviewCount: { $sum: 1 }, listingReviews: { $sum: { $cond: [{ $eq: ['$service', '$$serviceId'] }, 1, 0] } } } }
    ], as: 'ratings' } },
    { $set: { provider: { _id: '$owner._id', name: '$owner.name', profilePhoto: '$owner.profilePhoto' }, demo: { $or: [{ $eq: ['$demo', true] }, { $eq: ['$owner.demo', true] }] }, portfolio: '$owner.portfolio', availability: '$owner.availability', verified: { $and: [{ $eq: ['$owner.verified', true] }, { $ne: ['$owner.demo', true] }, { $ne: ['$demo', true] }] }, rating: { $ifNull: [{ $first: '$ratings.rating' }, 0] }, reviewCount: { $ifNull: [{ $first: '$ratings.reviewCount' }, 0] } } },
    { $set: { listingReviews: { $ifNull: [{ $first: '$ratings.listingReviews' }, 0] } } },
    { $unset: ['owner','ratings'] }
  );
  if (query.verified === 'true') stages.push({ $match: { verified: true } });
  if (query.minRating !== undefined) {
    if (Number(query.minRating) < 0 || Number(query.minRating) > 5) throw Error('Rating must be between 0 and 5.');
    stages.push({ $match: { rating: { $gte: Number(query.minRating) } } });
  }
  if (query.availableDay !== undefined && query.availableDay !== '') {
    const day = Number(query.availableDay);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw Error('Choose a valid day.');
    stages.push({ $match: { $or: [{ 'availability.days': day }, { 'availability.days': { $size: 0 } }, { 'availability.days': { $exists: false } }] } });
  }
  if (query.search) stages.push({ $set: { relevance: { $add: [
    { $cond: [{ $regexMatch: { input: '$title', regex: escape(query.search), options: 'i' } }, 3, 0] },
    { $cond: [{ $regexMatch: { input: '$category', regex: escape(query.search), options: 'i' } }, 2, 0] },
    { $cond: [{ $regexMatch: { input: '$description', regex: escape(query.search), options: 'i' } }, 1, 0] }
  ] } } });
  // Collapse exact, unrated copies in the public directory. Keep the original
  // listing as the canonical result and retain reviewed listings independently.
  stages.push(
    { $sort: { createdAt: 1, _id: 1 } },
    { $group: { _id: {
      provider: '$provider._id', title: '$title', category: '$category', location: '$location',
      description: '$description', price: '$price', image: { $ifNull: ['$image', ''] },
      coordinates: { $ifNull: ['$coordinates.coordinates', null] }, demo: '$demo',
      reviewedListing: { $cond: [{ $gt: ['$listingReviews', 0] }, '$_id', null] }
    }, listing: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$listing' } },
    { $unset: 'listingReviews' }
  );
  const sorting = { low: { price: 1 }, high: { price: -1 }, rating: { rating: -1, reviewCount: -1 }, distance: { distance: 1 }, relevance: { relevance: -1, verified: -1, rating: -1 } };
  stages.push({ $sort: { ...(sorting[query.sort] || { createdAt: -1 }), _id: 1 } }, { $limit: 100 });
  return stages;
}
module.exports = { directoryPipeline };
