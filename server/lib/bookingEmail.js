const User = require('../models/User');
const Service = require('../models/Service');
const EmailDelivery = require('../models/EmailDelivery');
const receipt = require('./demoReceipt');

const subjects = { pending: 'Booking requested', confirmed: 'Booking confirmed', cancelled: 'Booking cancelled', completed: 'Booking completed' };
const formatDate = new Intl.DateTimeFormat('en-ZA', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Johannesburg' });

function message(booking, event, customer, provider, service, from = receipt.previewSender) {
  const title = subjects[event.bookingStatus];
  const details = [
    ['Service', service?.title || 'LocalTrustSA service'],
    ['Provider', provider?.name || 'LocalTrustSA provider'],
    ['Booking reference', booking._id],
    ['Appointment', formatDate.format(event.appointmentDate || booking.bookingDate) + ' SAST'],
    ['Status', event.bookingStatus],
  ];
  if (Number.isFinite(booking.agreedPrice)) {
    details.push(['Agreed service price', new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(booking.agreedPrice)]);
  }
  const greeting = `Hello ${customer.name},`;
  const paragraph = event.bookingStatus === 'pending' ? 'Your provider will review the request. View the latest status in My dashboard.' :
    'View your booking details in My dashboard.';
  return {
    from, to: { address: customer.email }, subject: 'LocalTrustSA | ' + title,
    messageId: `<booking-${event._id}@${from.split('@').at(-1)}>`,
    text: [greeting, title, paragraph, ...details.map(([name, value]) => `${name}: ${value}`)].join('\n'),
    html: `<!doctype html><html lang="en"><meta charset="utf-8"><main style="max-width:600px;margin:auto;font-family:Arial;color:#112d43">
      <header style="padding:24px;background:#112d43;color:white"><strong>LocalTrustSA</strong><h1>${title}</h1></header>
      <section style="padding:24px;background:#edf7f4"><p>${receipt.escapeHtml(greeting)}</p><p>${paragraph}</p>
      <dl>${details.map(([name, value]) => `<dt><strong>${name}</strong></dt><dd style="margin:4px 0 12px">${receipt.escapeHtml(value)}</dd>`).join('')}</dl></section></main></html>`,
  };
}

const event = (status, appointmentDate, description = subjects[status]) =>
  ({ type: 'booking', message: description, bookingStatus: status, appointmentDate, createdAt: new Date() });

async function references(booking) {
  return Promise.all([User.findById(booking.provider).select('name'), Service.findById(booking.service).select('title')]);
}

function mode(env = process.env) {
  return env.BOOKING_EMAIL_MODE === 'smtp' && env.DEMO_SMTP_HOST && env.DEMO_SMTP_USER &&
    env.DEMO_SMTP_PASS && env.DEMO_SMTP_FROM ? 'smtp' : 'preview';
}

async function deliver(booking, timelineEvent, env = process.env) {
  if (!timelineEvent?._id || mode(env) !== 'smtp' || env.NODE_ENV === 'test' || env.NODE_TEST_CONTEXT) return;
  const customer = await User.findById(booking.customer).select('name email active suspended demo');
  if (!customer || customer.active === false || customer.suspended || customer.demo || /@demo\.localtrust\.test$/i.test(customer.email)) return;
  const [provider, service] = await references(booking);
  const id = String(timelineEvent._id) + ':' + String(customer._id);
  try { await EmailDelivery.create({ _id: id, status: 'sending' }); }
  catch (error) { if (error.code === 11000) return; throw error; }
  let status = 'uncertain';
  try { status = await receipt.submitMessage(customer.email, from => message(booking, timelineEvent, customer, provider, service, from), env); }
  finally {
    await EmailDelivery.updateOne({ _id: id }, { $set: { status, ...(status === 'submitted' ? { submittedAt: new Date() } : {}) } });
  }
}

function notify(booking, status) {
  const timelineEvent = booking.timeline?.findLast(item => item.bookingStatus === status);
  void deliver(booking, timelineEvent).catch(() => console.warn('Booking email delivery could not be completed.'));
}

module.exports = { message, mode, event, references, deliver, notify };
