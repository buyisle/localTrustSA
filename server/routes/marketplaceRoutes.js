const router=require('express').Router();
const mongoose=require('mongoose');
const {protect}=require('../Middleware/authMiddleware');
const Booking=require('../models/Booking');
const Service=require('../models/Service');
const User=require('../models/User');
const {Audit,Dispute}=require('../models/Operations');
const {directoryPipeline}=require('../lib/directory');
const {rankProviders}=require('../lib/intelligence');
const bookingEmail = require('../lib/bookingEmail');
const {parseBookingDate,availableAt,occupiedMinutes,DURATION}=require('../lib/scheduling');
const owned=(booking,user)=>[String(booking.customer),String(booking.provider)].includes(String(user._id));
const event=(type,message)=>({type,message,createdAt:new Date()});
async function recommendations(query) {
 const date=query.date ? parseBookingDate(query.date) : null;
 if(query.date && !date) throw Object.assign(Error('Choose a valid future appointment with a timezone.'), { status: 400 });
 let pipeline;
 try { pipeline=directoryPipeline({...query,sort:'relevance'}); }
 catch (error) { error.status=400; throw error; }
 const services=await Service.aggregate(pipeline);
 const history=await Booking.aggregate([{ $match:{status:'completed'} },{ $lookup:{from:'services',localField:'service',foreignField:'_id',as:'offer'} },...(query.category?[{$match:{'offer.category':query.category}}]:[]),{$group:{_id:'$provider',count:{$sum:1}}}]);
 let candidates=services;
 if(date) {
  const busy=await Booking.distinct('provider',{status:{$in:['pending','confirmed']},bookingDate:{$gt:new Date(date.getTime()-DURATION),$lt:new Date(date.getTime()+DURATION)}});
  const ids=new Set(busy.map(String)); candidates=services.filter(service=>!ids.has(String(service.provider._id)));
 }
 return rankProviders(candidates,{category:query.category,date,completed:new Map(history.map(item=>[String(item._id),item.count]))});
}
router.get('/recommendations',async(req,res)=>{
 try{res.json({method:'Deterministic weighted ranking, not a trained ML model',recommendations:await recommendations(req.query)});}catch(error){if(error.status!==400) throw error;res.status(400).json({message:error.message});}
});
const assistant = require('../lib/assistant');
const optionalAuth = (req, res, next) => req.headers.authorization ? protect(req, res, next) : next();
async function recentBookings(user) {
 const filter = user.role === 'provider' ? { provider: user._id } : { customer: user._id };
 const bookings = await Booking.find(filter).select('bookingDate status service').populate('service', 'title').sort({bookingDate:-1}).limit(5);
 return { mode: 'booking-status', reply: bookings.length ? 'Your latest appointments are shown below.' : 'You have no bookings yet.', bookings };
}
router.post('/assistant', optionalAuth, (req, res, next) => {
 if (!assistant.validInput(req.body)) return res.status(400).json({ message: 'Enter a question of up to 2000 characters and up to four recent messages.' });
 res.set('Cache-Control', 'no-store');
 next();
}, assistant.allow, async (req, res) => {
 try {
  let fallback = false;
  const result = await assistant.answer(req.body).catch(error => {
   const directory = assistant.directoryFallback(req.body);
   if (!directory) throw error;
   fallback = true;
   return directory;
  });
  if (result.intent === 'bookings') {
   if (req.user?.role === 'customer') return res.json(await recentBookings(req.user));
   return res.json({ mode: 'navigation', reply: 'Sign in as a customer to see your own bookings in My dashboard.' });
  }
  if (result.intent === 'search' && result.category) {
   const area = (result.location.trim() || req.body.location?.trim() || '').slice(0, 100);
   const services = await assistant.findServices(result.category, area);
   const match = area ? `${result.category} listings in ${area}` : `${result.category} listings`;
   const reply = services.length ? `Here are matching ${match}. Check the listing to request an appointment.` :
    `No matching ${match} were found. Try another area or browse the directory.`;
   return res.json({ mode: 'directory', reply: fallback ? 'Directory search (AI unavailable). ' + reply : reply, category: result.category, services });
  }
  const reply = result.reply.slice(0, 1500);
  res.json({ mode: 'ai', reply: result.intent === 'payment' ? 'DEMO checkout is a simulation. No real money is transferred.\n\n' + reply : reply });
 } catch {
  res.status(503).json({ message: assistant.unavailable });
 }
});
router.get('/assistant/bookings', protect, async (req, res) => {
 res.set('Cache-Control', 'no-store');
 res.json(await recentBookings(req.user));
});
router.use(protect);
router.get('/notifications',async(req,res)=>{
 const bookings=await Booking.find({$or:[{customer:req.user._id},{provider:req.user._id}]}).select('timeline service').populate('service','title').sort({updatedAt:-1}).limit(100);
 const items=bookings.flatMap(booking=>(booking.timeline||[]).map(item=>({id:String(item._id),bookingId:booking._id,message:item.message,type:item.type,createdAt:item.createdAt,read:item.readBy.some(id=>String(id)===String(req.user._id)),service:booking.service?.title}))).sort((a,b)=>b.createdAt-a.createdAt).slice(0,100);
 res.json(items);
});
router.patch('/notifications/:id/read',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:'Invalid notification.'});
 const result=await Booking.updateOne({$or:[{customer:req.user._id},{provider:req.user._id}],'timeline._id':req.params.id},{$addToSet:{'timeline.$.readBy':req.user._id}});
 if(!result.matchedCount)return res.status(404).json({message:'Notification not found.'});res.json({read:true});
});
router.patch('/profile',async(req,res)=>{
 const {name,location,availability,profilePhoto,biography,experience}=req.body;
 if(typeof name!=='string'||!name.trim()||name.length>120||typeof location!=='string'||location.length>160)return res.status(400).json({message:'Enter a name and valid service area.'});
 const set={name:name.trim(),location:location.trim()};
 for (const [field, value, limit] of [['biography', biography, 1200], ['experience', experience, 500]]) {
  if (value === undefined) continue;
  if (req.user.role !== 'provider') return res.status(403).json({message:'Only providers can manage professional profiles.'});
  if (typeof value !== 'string' || value.length > limit) return res.status(400).json({message:'Professional profile text is too long.'});
  set[field] = value.trim();
 }
 if(profilePhoto!==undefined){
  if(req.user.role!=='provider')return res.status(403).json({message:'Only providers can manage a public profile photo.'});
  const url = typeof profilePhoto === 'string' && profilePhoto.length <= 500 ? URL.parse(profilePhoto) : null;
  if(profilePhoto !== '' && (!url || url.protocol !== 'https:' || url.username || url.password)) {
   return res.status(400).json({message:'Enter a public HTTPS photo URL or leave it blank.'});
  }
  set.profilePhoto = url?.href || '';
 }
 if(availability!==undefined){
  if(req.user.role!=='provider')return res.status(403).json({message:'Only providers can configure availability.'});
  if(!Array.isArray(availability.days)||!availability.days.length||availability.days.some(day=>!Number.isInteger(day)||day<0||day>6)||!Number.isInteger(availability.startHour)||!Number.isInteger(availability.endHour)||availability.startHour<0||availability.endHour>24||availability.startHour>=availability.endHour)return res.status(400).json({message:'Select working days and valid opening and closing hours.'});
  set.availability=availability;
 }
 res.json(await User.findByIdAndUpdate(req.user._id,{$set:set},{new:true,runValidators:true}).select('name location availability portfolio profilePhoto'));
});
router.get('/profile',async(req,res)=>res.json(await User.findById(req.user._id).select('name location availability portfolio profilePhoto biography experience')));
router.param('bookingId',async(req,res,next,id)=>{
 if(!mongoose.isValidObjectId(id))return res.status(400).json({message:'Invalid booking.'});
 const booking=await Booking.findById(id);
 if(!booking||!owned(booking,req.user))return res.status(404).json({message:'Booking not found.'});req.booking=booking;next();
});
router.post('/appointments/:bookingId/reschedule',async(req,res)=>{
 const booking=req.booking;
 if(req.user.role!=='provider'||!['pending','confirmed'].includes(booking.status))return res.status(403).json({message:'Only the provider can propose a time for an open appointment.'});
 const date=parseBookingDate(req.body.bookingDate);
 if(!date||!availableAt(req.user,date))return res.status(400).json({message:'Choose a future appointment within your working hours.'});
 const result=await Booking.findOneAndUpdate({_id:booking._id,status:booking.status},{$set:{proposedDate:date},$push:{timeline:event('reschedule','Provider proposed '+date.toISOString()+'; awaiting customer response.')}},{new:true});
 if(!result)return res.status(409).json({message:'Booking changed. Refresh and try again.'});res.json(result);
});
router.post('/appointments/:bookingId/reschedule-response',async(req,res)=>{
 const booking=req.booking;
 if(req.user.role!=='customer'||!['pending','confirmed'].includes(booking.status)||!booking.proposedDate||typeof req.body.accept!=='boolean')return res.status(409).json({message:'No open proposal to respond to.'});
 const update={$unset:{proposedDate:1},$push:{timeline:event('reschedule',req.body.accept?'Customer accepted the alternative appointment.':'Customer declined the alternative appointment.')}};
 if(req.body.accept){
  const date=parseBookingDate(booking.proposedDate.toISOString());
  const provider=await User.findById(booking.provider);
  const service=await Service.findById(booking.service);
  if(!date||!availableAt(provider,date)||!service||service.active===false)return res.status(409).json({message:'The proposed appointment is no longer available.'});
  const busy=await Booking.exists({_id:{$ne:booking._id},provider:booking.provider,status:{$in:['pending','confirmed']},bookingDate:{$gt:new Date(date.getTime()-DURATION),$lt:new Date(date.getTime()+DURATION)}});
  if(busy)return res.status(409).json({message:'The proposed time is already reserved.'});
  update.$set={bookingDate:date,occupiedMinutes:occupiedMinutes(date),status:'confirmed'};
  if (booking.status === 'pending') update.$push.timeline = { $each: [update.$push.timeline, bookingEmail.event('confirmed', date)] };
 }
 try{const result=await Booking.findOneAndUpdate({_id:booking._id,status:booking.status,proposedDate:booking.proposedDate},update,{new:true});if(!result)return res.status(409).json({message:'Proposal changed. Refresh and try again.'});res.json(result);
  if (booking.status === 'pending' && req.body.accept) bookingEmail.notify(result, 'confirmed');
 }
 catch(error){if(error.code===11000)return res.status(409).json({message:'That time was just reserved.'});throw error;}
});
router.post('/appointments/:bookingId/payment',async(req,res)=>{
 const booking=req.booking;const {method,outcome}=req.body;
 if(!['cash','simulation'].includes(method)||!['pending','paid','failed'].includes(outcome))return res.status(400).json({message:'Choose cash or simulation and a valid status.'});
 if(method==='simulation'){
  if(req.user.role!=='customer')return res.status(403).json({message:'Only the customer can use payment simulation.'});
  if(booking.payment?.method==='simulation'&&booking.payment.status==='paid')return res.json(booking.payment);
  return res.status(409).json({message:'Open Demo checkout from your booking to simulate a payment.'});
 }
 if(booking.payment?.status==='paid')return res.json(booking.payment);
 if(!Number.isFinite(booking.agreedPrice))return res.status(409).json({message:'This historical booking has no agreed price. Contact support before recording a payment.'});
 if(!['confirmed','completed'].includes(booking.status))return res.status(409).json({message:'Payments require a confirmed or completed appointment.'});
 if(method==='cash'&&(outcome==='failed'||outcome==='paid'&&(req.user.role!=='provider'||booking.status!=='completed')))return res.status(403).json({message:'Only the provider can record cash received after completion.'});
 const payment={method,status:outcome,reference:`CASH-${booking._id}`, ...(outcome==='paid'?{paidAt:new Date()}:{})};
 const updated=await Booking.findOneAndUpdate({_id:booking._id,status:booking.status,'payment.status':{$ne:'paid'}},{$set:{payment},$push:{timeline:event('payment',`Cash payment ${outcome}`)}},{new:true});
 if(!updated)return res.status(409).json({message:'Payment or booking changed. Refresh before retrying.'});res.json(updated.payment);
});
router.get('/appointments/:bookingId/receipt',async(req,res)=>{
 const booking=req.booking;if(booking.payment?.status!=='paid')return res.status(409).json({message:'A receipt is available after payment is recorded.'});
 if(!Number.isFinite(booking.agreedPrice))return res.status(409).json({message:'The original agreed price is unavailable for this historical booking.'});
 res.json({reference:booking.payment.reference,method:booking.payment.method,simulation:booking.payment.method==='simulation',amount:booking.agreedPrice,currency:'ZAR',paidAt:booking.payment.paidAt,bookingId:booking._id});
});
router.post('/appointments/:bookingId/dispute',async(req,res)=>{
 if(typeof req.body.reason!=='string'||!req.body.reason.trim()||req.body.reason.length>2000)return res.status(400).json({message:'Describe the dispute in up to 2000 characters.'});
 res.status(201).json(await Dispute.create({booking:req.booking._id,raisedBy:req.user._id,reason:req.body.reason.trim()}));
});
router.use('/admin',(req,res,next)=>{if(req.user.role!=='admin')return res.status(403).json({message:'Administrator access required.'});next();});
router.get('/admin/overview',async(req,res)=>{
 const [users,bookings,reviews,disputes,audit]=await Promise.all([
 User.find().select('name email role active suspended verified demo').sort({createdAt:-1}).limit(100),
 Booking.find().select('service bookingDate status agreedPrice payment customer provider').populate('service','title').populate('customer provider','name').sort({createdAt:-1}).limit(100),
 Booking.find({'review.rating':{$exists:true}}).select('review service').populate('service','title').sort({'review.riskScore':-1}).limit(100),
 Dispute.find().sort({createdAt:-1}).limit(100),Audit.find().sort({createdAt:-1}).limit(100)]);
 res.json({users,bookings,reviews,disputes,audit});
});
router.patch('/admin/users/:id',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:'Invalid user.'});
 const set={};for(const key of ['active','suspended','verified'])if(typeof req.body[key]==='boolean')set[key]=req.body[key];
 if(!Object.keys(set).length)return res.status(400).json({message:'Choose a user status change.'});
 const user=await User.findById(req.params.id);if(!user)return res.status(404).json({message:'User not found.'});
 if(user.role==='admin')return res.status(403).json({message:'Administrator accounts require separate account recovery procedures.'});
 if(set.verified===true&&(user.role!=='provider'||user.demo))return res.status(400).json({message:'Only real provider accounts can be verified.'});
 await Audit.create({actor:req.user._id,action:JSON.stringify(set),target:String(user._id)});
 await User.updateOne({_id:user._id},{$set:set});res.json({message:'User updated.'});
});
router.patch('/admin/reviews/:id',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id)||!['approved','rejected','pending'].includes(req.body.moderation))return res.status(400).json({message:'Choose a valid moderation action.'});
 await Audit.create({actor:req.user._id,action:'review '+req.body.moderation,target:req.params.id});
 const booking=await Booking.findOneAndUpdate({_id:req.params.id,'review.rating':{$exists:true}},{$set:{'review.moderation':req.body.moderation},$push:{timeline:event('review','Review moderation: '+req.body.moderation)}},{new:true});
 if(!booking)return res.status(404).json({message:'Review not found.'});res.json(booking.review);
});
router.patch('/admin/disputes/:id',async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id)||typeof req.body.resolution!=='string'||!req.body.resolution.trim()||req.body.resolution.length>2000)return res.status(400).json({message:'Enter a resolution of up to 2000 characters.'});
 await Audit.create({actor:req.user._id,action:'Dispute resolved',target:req.params.id});
 const result=await Dispute.findByIdAndUpdate(req.params.id,{$set:{status:'resolved',resolution:req.body.resolution.trim()}},{new:true});
 if(!result)return res.status(404).json({message:'Dispute not found.'});res.json(result);
});
module.exports=router;
