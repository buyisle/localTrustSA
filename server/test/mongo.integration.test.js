// Opt-in persistence test: never uses MONGO_URI or the application's current DB.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const crypto=require('node:crypto');
const uri=process.env.MONGO_TEST_URI;
test('real MongoDB: concurrent reservations, marketplace journeys and assistant directory', {skip:!uri?'Set MONGO_TEST_URI and confirm MONGO_TEST_DATABASE to run persistence checks.':false},async(t)=>{
 const expected=process.env.MONGO_TEST_DATABASE;
 if(process.env.NODE_ENV!=='test'||!expected||!/^localtrust_test_[a-z0-9_]+$/i.test(expected)||new URL(uri).pathname.slice(1)!==expected)throw Error('Require NODE_ENV=test and MONGO_TEST_DATABASE matching an isolated localtrust_test_* database.');
 process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
 process.env.DEMO_RECEIPT_MODE='preview';
 const app=require('../Server');const Booking=require('../models/Booking');const Service=require('../models/Service');
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const request=(path,body,token,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  await Booking.init();await Service.init();
  const run=crypto.randomUUID();const password=crypto.randomBytes(16).toString('hex');
  const providerResponse=await request('/auth/register',{name:'Integration provider (TEST)',email:`provider-${run}@localtrust.test`,password,role:'provider'});assert.equal(providerResponse.status,201);const provider=await providerResponse.json();
  const customerResponse=await request('/auth/register',{name:'Integration customer (TEST)',email:`customer-${run}@localtrust.test`,password,role:'customer'});assert.equal(customerResponse.status,201);const customer=await customerResponse.json();
  const listingResponse=await request('/services',{title:'Integration tap repair (TEST)',category:'Plumbing',description:'Isolated persistence test fixture',price:450,location:'Benoni',coordinates:{type:'Point',coordinates:[28.3698,-26.1885]}},provider.token);assert.equal(listingResponse.status,201);const listing=await listingResponse.json();
  const offer = { provider: provider.user.id, title: listing.title, category: listing.category,
    description: listing.description, price: listing.price, location: listing.location, coordinates: listing.coordinates };
  const copy = await Service.create(offer);
  const distinct = await Service.create({ ...offer, title: listing.title + ' (inspection only)' });
  const catalog = await request('/services?category=Plumbing&location=Benoni', null, null, 'GET');
  const catalogIds = (await catalog.json()).map(item => item._id);
  assert.equal([listing._id, String(copy._id)].filter(key => catalogIds.includes(key)).length, 1);
  assert.ok(catalogIds.includes(String(distinct._id)));
  const OpenAI = require('openai');
  process.env.OPENAI_API_KEY = 'isolated-test';
  t.mock.method(Object.getPrototypeOf(new OpenAI({ apiKey: 'isolated-test' }).responses), 'create', async () => ({
   output_text: JSON.stringify({ intent: 'search', category: 'Plumbing', location: 'Benoni', reply: 'Check the directory.' }),
  }));
  const assistant = await request('/marketplace/assistant', { message: 'Find a plumber in Benoni' });
  assert.equal(assistant.status, 200);
  const suggestions = (await assistant.json()).services;
  assert.ok(suggestions.length > 0 && suggestions.length <= 3);
  assert.ok(suggestions.every(item => item.category === 'Plumbing' && /Benoni/i.test(item.location) && !item.provider.email));
  assert.equal((await request('/services/' + copy._id, null, null, 'GET')).status, 200);
  const date=new Date(Date.now()+7*86400000);date.setUTCSeconds(0,0);
  const body={serviceId:listing._id,bookingDate:date.toISOString()};
  const responses=await Promise.all([request('/bookings',body,customer.token),request('/bookings',body,customer.token)]);assert.deepEqual(responses.map(item=>item.status).sort(),[201,409]);
  const created=await responses.find(item=>item.status===201).json();
  assert.equal((await request('/bookings',{...body,bookingDate:new Date(date.getTime()+30*60000).toISOString()},customer.token)).status,409);
  assert.equal((await request('/bookings',{...body,bookingDate:new Date(date.getTime()+60*60000).toISOString()},customer.token)).status,201);
  assert.equal((await request(`/bookings/${created.booking._id}/status`,{status:'confirmed'},provider.token,'PATCH')).status,200);
  const path = '/bookings/' + created.booking._id + '/demo-payment';
  const payments = await Promise.all(['demo-card', 'demo-eft'].map(method => request(path, {method}, customer.token)));
  for (const response of payments) {
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reference, 'DEMO-' + created.booking._id);
  }
  const saved = await Booking.findById(created.booking._id);
  assert.equal(saved.demoPayment.amount, 450);
  assert.equal(saved.demoPayment.receiptStatus, 'preview');
  assert.equal(saved.timeline.filter(item => item.type === 'demo-payment').length, 1);
  assert.equal(saved.payment.status, 'pending');
  const preview = await request(path + '/receipt-preview', null, customer.token, 'GET');
  assert.match((await preview.json()).html, /No real money was transferred/);
  const directory=await request('/services?lat=-26.1885&lng=28.3698&radius=10',null,null,'GET');assert.equal(directory.status,200);assert.ok((await directory.json()).some(item=>item._id===listing._id));
 }finally{await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();}
 // Records remain clearly labelled TEST inside the explicitly selected test DB.
});
