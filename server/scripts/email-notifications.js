// Optional email adapter worker. Never run by tests, API requests or seeding.
require('dotenv').config({path:require('node:path').join(__dirname,'../.env')});
const mongoose=require('mongoose');
const Booking=require('../models/Booking');
const EmailDelivery=require('../models/EmailDelivery');
async function deliverEmail(job,{url,token},fetcher=fetch){
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||!token)throw Error('Email adapter requires an HTTPS URL and EMAIL_WEBHOOK_TOKEN.');
 const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'Idempotency-Key':job.id},body:JSON.stringify({to:job.email,subject:'Local Trust SA booking update',text:job.message,notificationId:job.id}),signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!response.ok)throw Error('Email adapter rejected the notification.');
}
async function run(){
 if(!process.env.MONGO_URI||!process.env.EMAIL_WEBHOOK_URL||!process.env.EMAIL_WEBHOOK_TOKEN)throw Error('Configure MONGO_URI, EMAIL_WEBHOOK_URL and EMAIL_WEBHOOK_TOKEN before running the email worker.');
 await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await EmailDelivery.init();
 const since=new Date(Date.now()-7*86400000);
 const bookings=Booking.find({'timeline.createdAt':{$gte:since}}).select('timeline customer provider').populate('customer provider','email active suspended').sort({updatedAt:1}).cursor();
 let count=0;
 for await (const booking of bookings)for(const event of booking.timeline)if(event.createdAt>=since)for(const person of [booking.customer,booking.provider]){
  if(event.type==='demo-payment'||event.bookingStatus&&String(person?._id)===String(booking.customer?._id))continue;
  if(!person?.email||person.active===false||person.suspended||/@demo\.localtrust\.test$/i.test(person.email))continue;
  const id=String(event._id)+':'+String(person._id);
  try{await EmailDelivery.updateOne({_id:id},{$setOnInsert:{status:'pending'}},{upsert:true});}catch(error){if(error.code!==11000)throw error;}
  const now=new Date();
  const claim=await EmailDelivery.findOneAndUpdate({_id:id,status:{$ne:'submitted'},$or:[{leaseUntil:{$exists:false}},{leaseUntil:{$lt:now}}]},{$set:{leaseUntil:new Date(now.getTime()+60000)}},{new:true});
  if(!claim)continue;
  try{await deliverEmail({id,email:person.email,message:event.message},{url:process.env.EMAIL_WEBHOOK_URL,token:process.env.EMAIL_WEBHOOK_TOKEN});await EmailDelivery.updateOne({_id:id},{$set:{status:'submitted',submittedAt:new Date()},$unset:{leaseUntil:1,lastError:1}});count++;}
  catch{await EmailDelivery.updateOne({_id:id},{$set:{status:'failed',lastError:'Delivery adapter unavailable; retry this job.'},$unset:{leaseUntil:1}});}
 }
 console.log(`${count} notifications accepted by the configured email adapter.`);
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
module.exports={deliverEmail};
