const {test,before,after,afterEach,mock}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const User=require('../models/User');
const Service=require('../models/Service');
const Booking=require('../models/Booking');
const {Audit,Dispute}=require('../models/Operations');
const {directoryPipeline}=require('../lib/directory');
const {rankProviders,reviewRisk}=require('../lib/intelligence');
process.env.JWT_SECRET='isolated-marketplace-test-secret';
const app=require('../Server');
const customer='111111111111111111111111',provider='222222222222222222222222',id='333333333333333333333333';
let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}/api`;});
after(()=>new Promise(resolve=>server.close(resolve)));
afterEach(()=>mock.restoreAll());
function headers(role='customer'){
 mock.method(User,'findById',async key=>({_id:key,role:String(key)===provider?'provider':role}));
 return {'Content-Type':'application/json',Authorization:'Bearer '+jwt.sign({id:role==='provider'?provider:customer},process.env.JWT_SECRET)};
}
const call=(path,body,auth={},method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...auth},...(body===undefined?{}:{body:JSON.stringify(body)})});
const chain=value=>({select(){return this;},populate(){return this;},sort(){return this;},limit(){return Promise.resolve(value);},then(resolve,reject){return Promise.resolve(value).then(resolve,reject);}});
test('booking API rejects current-day past time, malformed calendar and timezone-free strings',async()=>{
 const auth=headers();mock.method(Service,'findById',async()=>({_id:id,provider,price:350}));
 for(const bookingDate of [new Date(Date.now()-60000).toISOString(),'2099-02-31T12:00:00Z','2099-01-01T12:00','2099-01-01T24:00:00Z'])assert.equal((await call('/bookings',{serviceId:id,bookingDate},auth)).status,400);
});
test('booking API rejects provider conflicts and concurrent duplicate key writes',async()=>{
 const auth=headers();mock.method(Service,'findById',async()=>({_id:id,provider,price:350}));
 const exists=mock.method(Booking,'exists',async()=>true);
 assert.equal((await call('/bookings',{serviceId:id,bookingDate:'2099-01-01T10:00:00Z'},auth)).status,409);
 assert.deepEqual(exists.mock.calls[0].arguments[0].status,{$in:['pending','confirmed']});
 exists.mock.mockImplementation(async()=>false);
 mock.method(Booking,'create',async()=>{throw Object.assign(Error('duplicate'),{code:11000});});
 assert.equal((await call('/bookings',{serviceId:id,bookingDate:'2099-01-01T10:00:00Z'},auth)).status,409);
});
test('booking API rejects missing, inactive and suspended providers',async()=>{
 const auth=headers();mock.method(Service,'findById',async()=>({_id:id,provider,price:350}));
 for(const owner of [null,{role:'provider',active:false},{role:'provider',suspended:true},{role:'customer'}]){
  User.findById.mock.mockImplementation(async key=>String(key)===provider?owner:{_id:customer,role:'customer'});
  assert.equal((await call('/bookings',{serviceId:id,bookingDate:'2099-01-01T10:00:00Z'},auth)).status,409);
 }
});
test('geospatial directory pipeline runs near first and excludes private provider fields',()=>{
 const pipeline=directoryPipeline({search:'tap.*',category:'Plumbing',lat:'-26.2',lng:'28.04',radius:'10',minPrice:'200',maxPrice:'800',minRating:'4',verified:'true',availableDay:'1',sort:'distance'});
 assert.equal(pipeline[0].$geoNear.maxDistance,10000);
 assert.deepEqual(pipeline[0].$geoNear.near.coordinates,[28.04,-26.2]);
 assert.equal(pipeline[0].$geoNear.query.$or[0].title.$regex,'tap\\.\\*');
 assert.deepEqual(pipeline.find(stage=>stage.$set)?.$set.provider,{_id:'$owner._id',name:'$owner.name',profilePhoto:'$owner.profilePhoto'});
 assert.ok(pipeline.some(stage=>stage.$unset?.includes('owner')));
 for(const query of [{lat:'NaN'},{lat:'100',lng:'0'},{sort:'distance'},{minRating:'6'},{availableDay:'7'},{category:'unknown'}])assert.throws(()=>directoryPipeline(query));
});
test('directory filters execute Mongo aggregation rather than client-side data',async()=>{
 const aggregate=mock.method(Service,'aggregate',async()=>[{_id:id,title:'Tap repair',price:450}]);
 const response=await fetch(base+'/services?category=Plumbing&location=Benoni&maxPrice=500&sort=low');
 assert.equal(response.status,200);assert.equal((await response.json())[0].title,'Tap repair');
 const pipeline=aggregate.mock.calls[0].arguments[0];assert.equal(pipeline[0].$match.price.$lte,500);assert.equal(pipeline[0].$match.location.$regex,'Benoni');
 assert.equal((await fetch(base+'/services?minPrice=invalid')).status,400);
});
test('recommendation ranks eligible providers, deduplicates, ties stably and explains scores',()=>{
 const offer=(key,fields={})=>({_id:key,category:'Plumbing',provider:{_id:key,name:key},location:'Benoni',rating:0,...fields});
 const candidates=[offer('b'),offer('a',{verified:true,rating:5,distance:1000}),offer('c',{active:false}),offer('d',{category:'Beauty'}),offer('a',{_id:'second-a'})];
 const result=rankProviders(candidates,{category:'Plumbing',completed:new Map([['a',4]])});
 assert.equal(result[0].providerId,'a');assert.equal(result.length,2);assert.equal(result[0].rank,1);assert.ok(result[0].score>result[1].score);assert.match(result[0].explanation,/Matches your Plumbing/);
 const ties=rankProviders([offer('b'),offer('a')]);assert.equal(ties[0].providerId,'a');
});
test('recommendations exclude closed hours and actual conflicting appointments',async()=>{
 mock.method(Service,'aggregate',async()=>[{_id:id,category:'Plumbing',location:'Benoni',provider:{_id:provider}}]);
 mock.method(Booking,'aggregate',async()=>[]);mock.method(Booking,'distinct',async()=>[provider]);
 const response=await fetch(base+'/marketplace/recommendations?category=Plumbing&date=2099-01-01T10:00:00Z');
 assert.equal(response.status,200);assert.deepEqual((await response.json()).recommendations,[]);
});
const OpenAI = require('openai');
const responses = Object.getPrototypeOf(new OpenAI({ apiKey: 'unit-test' }).responses);
let minute = Date.UTC(2030, 0, 1, 12);
function model(respond) {
 process.env.OPENAI_API_KEY = 'unit-test';
 minute += 60_000;
 mock.method(Date, 'now', () => minute);
 return mock.method(responses, 'create', async function (request) {
  assert.equal(this._client.timeout, 8000);
  assert.equal(this._client.maxRetries, 0);
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 400);
  return { output_text: JSON.stringify({ intent: 'help', category: '', location: '', reply: 'Open My dashboard.', ...respond(JSON.parse(request.input)) }) };
 });
}
test('AI answers general support and DEMO payment questions using bounded, redacted context', async () => {
 const sdk = model(input => {
  assert.doesNotMatch(JSON.stringify(input), /qa@example.test|4111 1111 1111 1111/);
  return input.message.includes('EFT') ? { intent: 'payment', reply: 'View DEMO confirmation from My dashboard.' } : {};
 });
 const first = await call('/marketplace/assistant', { message: 'Where can I see pending confirmation?' });
 assert.deepEqual(await first.json(), { mode: 'ai', reply: 'Open My dashboard.' });
 const payment = await call('/marketplace/assistant', { message: 'How does EFT work? qa@example.test 4111 1111 1111 1111' });
 assert.match((await payment.json()).reply, /No real money is transferred/);
 assert.equal(sdk.mock.calls.length, 2);
});
test('assistant searches real listing fields and carries area follow-ups into Mongo filters', async () => {
 model(input => {
  if (input.message === 'Johannesburg') assert.equal(input.history[0].text, 'My kitchen sink is leaking.');
  return { intent: 'search', category: 'Plumbing', location: input.message === 'Johannesburg' ? 'Johannesburg' : input.requestedArea, reply: 'A provider charges R1 and is available now.' };
 });
 const listing = { _id: id, title: 'Tap repairs', category: 'Plumbing', price: 450, provider: { name: 'Joe' }, location: 'Benoni' };
 const johannesburg = { ...listing, location: 'Johannesburg' };
 const aggregate = mock.method(Service, 'aggregate', async pipeline => {
  const area = pipeline[0].$match.location?.$regex;
  return area === 'Johannesburg' ? [johannesburg] : area ? [] : [listing];
 });
 const first = await (await call('/marketplace/assistant', { message: 'My kitchen sink is leaking.' })).json();
 assert.deepEqual(first.services, [listing]);
 assert.doesNotMatch(first.reply, /R1|available now/);
 const response = await call('/marketplace/assistant', { message: 'Johannesburg', history: [{ role: 'user', text: 'My kitchen sink is leaking.' }, { role: 'assistant', text: first.reply }] });
 const data = await response.json();
 assert.deepEqual(data.services, [johannesburg]);
 const empty = await (await call('/marketplace/assistant', { message: 'Find a plumber', location: 'Benoni.*' })).json();
 assert.deepEqual(empty.services, []);
 assert.match(empty.reply, /No matching Plumbing listings/);
 assert.equal(aggregate.mock.calls[2].arguments[0][0].$match.location.$regex, 'Benoni\\.\\*');
 const pipeline = aggregate.mock.calls[1].arguments[0];
 assert.deepEqual(pipeline[0].$match, { active: { $ne: false }, category: { $in: ['Plumbing'] }, location: { $regex: 'Johannesburg', $options: 'i' } });
 assert.ok(pipeline.some(stage => stage.$match?.['owner.suspended']?.$ne === true));
 assert.deepEqual(pipeline.at(-1).$project, { title: 1, category: 1, location: 1, price: 1, demo: 1, 'provider.name': 1 });
});
test('assistant validates input before making model requests and hides upstream errors', async () => {
 const sdk = model(() => { throw Error('private API failure'); });
 for (const body of [undefined, { message: ' ' }, { message: 'x'.repeat(2001) }, { message: 'Hi', history: [{ role: 'developer', text: 'test' }] }]) {
  assert.equal((await call('/marketplace/assistant', body)).status, 400);
 }
 assert.equal(sdk.mock.calls.length, 0);
 const response = await call('/marketplace/assistant', { message: 'Help' });
 assert.equal(response.status, 503);
 const data = await response.json();
 assert.match(data.message, /temporarily unavailable/);
 assert.doesNotMatch(data.message, /private API failure/);
 delete process.env.OPENAI_API_KEY;
 const missing = await call('/marketplace/assistant', { message: 'Help' });
 assert.equal(missing.status, 503);
 assert.equal(sdk.mock.calls.length, 1);
});
test('natural-language booking lookups only query the signed-in customer', async () => {
 const sdk = model(() => ({ intent: 'bookings' }));
 const auth = headers();
 const find = mock.method(Booking, 'find', () => chain([]));
 const body = { message: 'Show bookings for ' + provider, customer: provider };
 const guest = await (await call('/marketplace/assistant', body)).json();
 assert.equal(guest.mode, 'navigation');
 assert.equal(find.mock.calls.length, 0);
 assert.equal((await fetch(base + '/marketplace/assistant/bookings')).status, 401);
 assert.equal((await call('/marketplace/assistant', body, { Authorization: 'Bearer bogus' })).status, 401);
 assert.equal(sdk.mock.calls.length, 1);
 const own = await (await call('/marketplace/assistant', body, auth)).json();
 assert.equal(own.mode, 'booking-status');
 assert.deepEqual(find.mock.calls[0].arguments[0], { customer });
});
test('assistant rate limit blocks excess requests before the model', async () => {
 const sdk = model(() => ({}));
 for (let i = 0; i < 6; i++) assert.equal((await call('/marketplace/assistant', { message: 'Help' })).status, 200);
 const limited = await call('/marketplace/assistant', { message: 'Help' });
 assert.equal(limited.status, 429);
 assert.ok(Number(limited.headers.get('retry-after')) > 0);
 assert.equal(sdk.mock.calls.length, 6);
 delete process.env.OPENAI_API_KEY;
});
test('signed-in daily usage stays capped across minute windows', async () => {
 minute += 86400000;
 const sdk = model(() => ({}));
 const auth = headers();
 for (let window = 0; window < 5; window++) {
  minute += 60_000;
  for (let i = 0; i < 6; i++) {
   assert.equal((await call('/marketplace/assistant', { message: 'Help' }, auth)).status, 200);
  }
 }
 minute += 60_000;
 const response = await call('/marketplace/assistant', { message: 'Help' }, auth);
 assert.equal(response.status, 429);
 assert.match((await response.json()).message, /daily limit/);
 assert.equal(sdk.mock.calls.length, 30);
 delete process.env.OPENAI_API_KEY;
});
test('when the AI is unavailable, the directory still finds listings and accepts an area follow-up', async () => {
 const sdk = model(() => { throw Error('offline'); });
 const find = mock.method(Service, 'aggregate', async () => [{ _id: id, title: 'Tap repair', location: 'Benoni' }]);
 const first = await (await call('/marketplace/assistant', { message: 'My kitchen tap is leaking.' })).json();
 assert.match(first.reply, /^Directory search \(AI unavailable\)/);
 assert.equal(first.services[0]._id, id);
 const followUp = await (await call('/marketplace/assistant', { message: 'Benoni', history: [
  { role: 'user', text: 'My kitchen tap is leaking.' }, { role: 'assistant', text: first.reply },
 ] })).json();
 assert.equal(followUp.category, 'Plumbing');
 assert.equal(find.mock.calls[1].arguments[0][0].$match.location.$regex, 'Benoni');
 assert.equal(sdk.mock.calls.length, 2);
 delete process.env.OPENAI_API_KEY;
});
test('only an owned uploaded portfolio picture can become the profile picture', async () => {
 const auth = headers('provider');
 const url = '/uploads/' + provider + '-11111111-1111-1111-1111-111111111111.png';
 const write = mock.method(User, 'findOneAndUpdate', async filter => filter['portfolio.url'] === url ? { profilePhoto: url } : null);
 const result = await call('/marketplace/portfolio/profile-photo', { url }, auth, 'PATCH');
 assert.deepEqual(await result.json(), { profilePhoto: url });
 assert.deepEqual(write.mock.calls[0].arguments[0], { _id: provider, 'portfolio.url': url });
 assert.equal((await call('/marketplace/portfolio/profile-photo', { url: '/uploads/another-provider.png' }, auth, 'PATCH')).status, 404);
});
test('private assistant scopes booking lookup to authenticated ownership',async()=>{
 const auth=headers();const find=mock.method(Booking,'find',()=>chain([]));
 const response=await fetch(base+'/marketplace/assistant/bookings',{headers:auth});assert.equal(response.status,200);assert.deepEqual(find.mock.calls[0].arguments[0],{customer});
});
test('payments enforce ownership, cash completion, legacy simulation receipt compatibility',async()=>{
 const auth=headers();let booking={_id:id,customer,provider,status:'confirmed',agreedPrice:450};
 mock.method(Booking,'findById',async()=>booking);
 const update=mock.method(Booking,'findOneAndUpdate',async(filter,changes)=>({...booking,payment:changes.$set.payment}));
 assert.equal((await call(`/marketplace/appointments/${id}/payment`,{method:'cash',outcome:'paid'},auth)).status,403);
 let response=await call(`/marketplace/appointments/${id}/payment`,{method:'simulation',outcome:'paid'},auth);
 assert.equal(response.status,409);const payment={method:'simulation',status:'paid',reference:'SIM-'+id,paidAt:new Date()};
 booking={...booking,payment};response=await call(`/marketplace/appointments/${id}/payment`,{method:'simulation',outcome:'paid'},auth);assert.equal(response.status,200);assert.equal(update.mock.calls.length,0);
 const receipt=await (await fetch(base+`/marketplace/appointments/${id}/receipt`,{headers:auth})).json();assert.equal(receipt.simulation,true);assert.equal(receipt.amount,450);
 booking={...booking,customer:provider};assert.equal((await call(`/marketplace/appointments/${id}/payment`,{method:'simulation',outcome:'paid'},auth)).status,404);
});
test('provider can record cash only after job completion',async()=>{
 const auth=headers('provider');let booking={_id:id,customer,provider,status:'confirmed',agreedPrice:450};mock.method(Booking,'findById',async()=>booking);
 assert.equal((await call(`/marketplace/appointments/${id}/payment`,{method:'cash',outcome:'paid'},auth)).status,403);
 booking.status='completed';mock.method(Booking,'findOneAndUpdate',async(_,changes)=>({payment:changes.$set.payment}));
 assert.equal((await call(`/marketplace/appointments/${id}/payment`,{method:'cash',outcome:'paid'},auth)).status,200);
 assert.equal((await call(`/marketplace/appointments/${id}/payment`,{method:'simulation',outcome:'paid'},auth)).status,403);
});
test('demo checkout claims one payment, retries a failed receipt once, and preserves cash', async () => {
 const auth = headers();
 const booking = { _id: id, customer, provider, status: 'confirmed', agreedPrice: 450,
  service: { title: 'Tap repair <test>' }, payment: { method: 'cash', status: 'pending' } };
 const path = '/bookings/' + id + '/demo-payment';
 const owned = filter => filter.customer === customer && filter._id === id;
 mock.method(Booking, 'findOne', filter => chain(owned(filter) ? booking : null));
 mock.method(Booking, 'exists', async filter => owned(filter) && booking.demoPayment?.status === 'confirmed');
 let writes = 0;
 mock.method(Booking, 'findOneAndUpdate', async (filter, { $set }) => {
  if (!owned(filter)) return null;
  if ($set.demoPayment) {
   if (booking.demoPayment || filter.status !== booking.status) return null;
   booking.demoPayment = $set.demoPayment;
   writes++;
  } else {
   const expected = filter['demoPayment.receiptStatus'];
   if (!booking.demoPayment || !(expected.$in ?? [expected]).includes(booking.demoPayment.receiptStatus)) return null;
   booking.demoPayment.receiptStatus = $set['demoPayment.receiptStatus'];
  }
  return booking;
 });
 let sends = 0;
 const receipt = require('../lib/demoReceipt');
 mock.method(receipt, 'submitReceipt', async () => ++sends === 1 ? 'failed' : 'submitted');

 assert.equal((await call(path, { method: 'demo-card' })).status, 401);
 assert.equal((await call(path, { method: 'demo-card', card: 'invalid' }, auth)).status, 400);
 assert.equal((await call(path.replace(id, provider), { method: 'demo-card' }, auth)).status, 404);
 const results = await Promise.all(['demo-card', 'demo-eft'].map(method => call(path, { method }, auth)));
 for (const result of results) {
  assert.equal(result.status, 200);
  const payment = await result.json();
  assert.equal(payment.reference, 'DEMO-' + id);
  assert.equal(payment.amount, 450);
 }
 assert.equal(writes, 1);
 assert.equal(sends, 1);
 assert.equal(booking.demoPayment.receiptStatus, 'failed');
 await Promise.all([call(path + '/receipt', {}, auth), call(path + '/receipt', {}, auth)]);
 assert.equal((await (await call(path + '/receipt', {}, auth)).json()).receiptStatus, 'submitted');
 assert.equal(sends, 2);
 assert.equal(booking.payment.status, 'pending');
 const message = receipt.receiptMessage(booking, { name: 'A & B', email: 'customer@example.test' }, 'receipts@example.test');
 assert.match(message.html, /Tap repair &lt;test&gt;/);
 assert.match(message.html, /No real money was transferred/);
 assert.equal(message.to.address, 'customer@example.test');
});
test('review risk is explainable, bounded, and never deletes a review',()=>{
 assert.equal(reviewRisk('Friendly professional explained the repair and arrived on time.').riskScore,0);
 const result=reviewRisk('GREAT!!!!!! HTTP://SPAM.EXAMPLE');assert.ok(result.riskSignals.length>=2);assert.ok(result.riskScore<=100);assert.ok(!('delete' in result));
});
test('all admin endpoints require strict administrator authorization',async()=>{
 for(const [path,method] of [['overview','GET'],['users/'+provider,'PATCH'],['reviews/'+id,'PATCH'],['disputes/'+id,'PATCH']]){
  const auth=headers();assert.equal((await call('/marketplace/admin/'+path,method==='GET'?undefined:{verified:true},auth,method)).status,403);mock.restoreAll();
 }
 assert.equal((await fetch(base+'/marketplace/admin/overview')).status,401);
});
test('administrators cannot verify fictional demo providers',async()=>{
 const auth=headers('admin');User.findById.mock.mockImplementation(async key=>String(key)===provider?{_id:provider,role:'provider',demo:true}:{_id:customer,role:'admin'});
 const response=await call('/marketplace/admin/users/'+provider,{verified:true},auth,'PATCH');assert.equal(response.status,400);
});
test('moderation requires explicit approval and appends an auditable update',async()=>{
 const auth=headers('admin');const audit=mock.method(Audit,'create',async value=>value);const update=mock.method(Booking,'findOneAndUpdate',async()=>({review:{moderation:'approved'}}));
 assert.equal((await call('/marketplace/admin/reviews/'+id,{moderation:'approved'},auth,'PATCH')).status,200);
 assert.equal(audit.mock.calls.length,1);assert.equal(update.mock.calls[0].arguments[1].$set['review.moderation'],'approved');
});
test('notification read operations scope to owner and update only their read state',async()=>{
 const auth=headers();const update=mock.method(Booking,'updateOne',async()=>({matchedCount:1}));
 assert.equal((await call('/marketplace/notifications/'+id+'/read',{},auth,'PATCH')).status,200);
 assert.deepEqual(update.mock.calls[0].arguments[0].$or,[{customer},{provider:customer}]);assert.equal(update.mock.calls[0].arguments[1].$addToSet['timeline.$.readBy'],customer);
});
test('reschedule acceptance validates conflicts and preserves original appointment on rejection',async()=>{
 const auth=headers();const booking={_id:id,customer,provider,service:id,status:'confirmed',proposedDate:new Date('2099-01-01T10:00:00Z')};
 mock.method(Booking,'findById',async()=>booking);mock.method(Service,'findById',async()=>({active:true}));const exists=mock.method(Booking,'exists',async()=>true);
 assert.equal((await call(`/marketplace/appointments/${id}/reschedule-response`,{accept:true},auth)).status,409);
 const update=mock.method(Booking,'findOneAndUpdate',async()=>booking);
 assert.equal((await call(`/marketplace/appointments/${id}/reschedule-response`,{accept:false},auth)).status,200);assert.equal(update.mock.calls[0].arguments[1].$set,undefined);
 exists.mock.mockImplementation(async()=>false);
 assert.equal((await call(`/marketplace/appointments/${id}/reschedule-response`,{accept:true},auth)).status,200);assert.equal(update.mock.calls[1].arguments[1].$set.occupiedMinutes.length,60);
});
test('profile cannot change role or verification and validates availability hours',async()=>{
 const auth=headers('provider');const update=mock.method(User,'findByIdAndUpdate',()=>({select:async()=>({name:'Provider'})}));
 assert.equal((await call('/marketplace/profile',{name:'Provider',location:'Benoni',role:'admin',verified:true},auth,'PATCH')).status,200);
 assert.deepEqual(update.mock.calls[0].arguments[1].$set,{name:'Provider',location:'Benoni'});
 assert.equal((await call('/marketplace/profile',{name:'Provider',location:'Benoni',profilePhoto:'http://example.test/photo.jpg'},auth,'PATCH')).status,400);
 assert.equal((await call('/marketplace/profile',{name:'Provider',location:'Benoni',profilePhoto:'https://example.test/photo.jpg'},auth,'PATCH')).status,200);
 assert.equal(update.mock.calls[1].arguments[1].$set.profilePhoto,'https://example.test/photo.jpg');
 assert.equal((await call('/marketplace/profile',{name:'Provider',location:'Benoni',availability:{days:[1],startHour:18,endHour:8}},auth,'PATCH')).status,400);
});
test('registration and login preserve existing authentication contracts',async()=>{
 mock.method(User,'findOne',async()=>null);const create=mock.method(User,'create',async fields=>({...fields,_id:customer}));
 const response=await call('/auth/register',{name:'New User',email:'NEW@example.test',password:'safe-test-password',role:'customer'});
 assert.equal(response.status,201);assert.ok((await response.json()).token);assert.equal(create.mock.calls[0].arguments[0].email,'new@example.test');
 User.findOne.mock.mockImplementation(()=>({select:async()=>({_id:customer,name:'New User',email:'new@example.test',role:'customer',comparePassword:async value=>value==='safe-test-password'})}));
 assert.equal((await call('/auth/login',{email:'new@example.test',password:'safe-test-password'})).status,200);
 assert.equal((await call('/auth/login',{email:'new@example.test',password:'wrong'})).status,401);
});
test('suspended sessions and login attempts are denied',async()=>{
 const auth=headers();User.findById.mock.mockImplementation(async()=>({_id:customer,role:'customer',suspended:true}));
 assert.equal((await fetch(base+'/bookings/my',{headers:auth})).status,401);
 mock.method(User,'findOne',()=>({select:async()=>({suspended:true,comparePassword:async()=>true})}));
 assert.equal((await call('/auth/login',{email:'test@example.test',password:'test-password'})).status,401);
});

test('portfolio endpoints require a provider and reject filenames outside their ownership',async()=>{
 const auth=headers();assert.equal((await call('/marketplace/portfolio',{data:'invalid',caption:'Test'},auth)).status,403);
 mock.restoreAll();const providerAuth=headers('provider');
 assert.equal((await call('/marketplace/portfolio/'+customer+'-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg',undefined,providerAuth,'DELETE')).status,400);
 assert.equal((await call('/marketplace/portfolio',{data:Buffer.from('<svg></svg>').toString('base64'),caption:'Test'},providerAuth)).status,400);
});
