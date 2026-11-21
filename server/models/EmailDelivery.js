const mongoose=require('mongoose');
module.exports=mongoose.model('EmailDelivery',new mongoose.Schema({
 _id:String,status:{type:String,enum:['pending','sending','submitted','failed','uncertain'],default:'pending'},leaseUntil:Date,submittedAt:Date,lastError:String
},{timestamps:true}));
