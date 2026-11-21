const {test}=require('node:test');const assert=require('node:assert/strict');
const {deliverEmail}=require('../scripts/email-notifications');
const {receiptMessage, submitReceipt, previewSender}=require('../lib/demoReceipt');
test('optional email adapter validates HTTPS and uses idempotency without real delivery',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true};};
 await assert.rejects(deliverEmail({id:'event:user',email:'user@example.test',message:'Booking confirmed'},{url:'http://insecure.example',token:'test'},fetcher),/HTTPS/);assert.equal(calls.length,0);
 await deliverEmail({id:'event:user',email:'user@example.test',message:'Booking confirmed'},{url:'https://email.example.test/send',token:'test-only'},fetcher);
 assert.equal(calls[0].options.headers['Idempotency-Key'],'event:user');assert.equal(JSON.parse(calls[0].options.body).to,'user@example.test');
 await assert.rejects(deliverEmail({id:'event:user'},{url:'https://email.example.test/send',token:'test'},async()=>({ok:false})),/rejected/);
});

test('demo receipt preview renders payment details locally and test mode disables SMTP', async () => {
 const booking = { _id: 'booking-123', demoPayment: {
  reference: 'DEMO-booking-123', serviceName: 'Plumbing & repairs', amount: 450,
  paidAt: new Date('2026-11-20T08:00:00Z'),
 } };
 const customer = { name: 'Test Customer', email: 'customer@example.test' };
 assert.equal(await submitReceipt(booking, customer, { DEMO_RECEIPT_MODE: 'preview' }), 'preview');
 assert.equal(await submitReceipt(booking, customer, { DEMO_RECEIPT_MODE: 'smtp', NODE_ENV: 'test' }), 'failed');
 const message = receiptMessage(booking, customer, previewSender);
 for (const field of [/Plumbing &amp; repairs/, /ZAR.*450/, /booking-123/, /20 November 2026/, /Confirmed/]) {
  assert.match(message.html, field);
 }
 assert.match(message.text, /No real money was transferred/);
});

test('booking update templates escape public text and SMTP delivery is claimed once', async t => {
 const bookingEmail = require('../lib/bookingEmail');
 const User = require('../models/User');
 const Service = require('../models/Service');
 const EmailDelivery = require('../models/EmailDelivery');
 const receipt = require('../lib/demoReceipt');
 const customer = { _id: '111', name: 'Customer <test>', email: 'customer@example.test' };
 const booking = { _id: '123', customer: customer._id, provider: '222', service: '333', bookingDate: new Date('2026-11-20T08:00:00Z') };
 const event = { _id: '444', bookingStatus: 'pending' };
 for (const status of ['pending', 'confirmed', 'cancelled', 'completed']) {
  const template = bookingEmail.message(booking, { ...event, bookingStatus: status }, customer, { name: 'Provider' }, { title: 'Tap & pipe' });
  assert.equal(template.to.address, customer.email);
  assert.match(template.html, /Customer &lt;test&gt;.*Tap &amp; pipe/s);
  assert.match(template.text, new RegExp('Status: ' + status));
  assert.match(template.text, /123.*20 November 2026.*SAST/s);
 }
 const env = { BOOKING_EMAIL_MODE: 'smtp', DEMO_SMTP_HOST: 'mock', DEMO_SMTP_USER: 'mock', DEMO_SMTP_PASS: 'mock', DEMO_SMTP_FROM: receipt.previewSender };
 t.mock.method(User, 'findById', id => ({ select: async () => id === customer._id ? customer : { name: 'Provider' } }));
 t.mock.method(Service, 'findById', () => ({ select: async () => ({ title: 'Tap repair' }) }));
 let claimed = false;
 t.mock.method(EmailDelivery, 'create', async () => {
  if (claimed) throw Object.assign(Error('duplicate delivery'), { code: 11000 });
  claimed = true;
 });
 const update = t.mock.method(EmailDelivery, 'updateOne', async () => {});
 const transport = t.mock.method(receipt, 'submitMessage', async () => { throw Error('SMTP unavailable'); });
 await bookingEmail.deliver(booking, event, { ...env, NODE_ENV: 'test' });
 assert.equal(transport.mock.calls.length, 0);
 await assert.rejects(bookingEmail.deliver(booking, event, env), /SMTP unavailable/);
 await bookingEmail.deliver(booking, event, env);
 assert.equal(transport.mock.calls.length, 1);
 assert.equal(update.mock.calls[0].arguments[1].$set.status, 'uncertain');
});
