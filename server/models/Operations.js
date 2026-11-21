const mongoose=require('mongoose');
const audit=new mongoose.Schema({ actor:{type:mongoose.Schema.Types.ObjectId,ref:'User'}, action:String, target:String },{timestamps:true});
const dispute=new mongoose.Schema({ booking:{type:mongoose.Schema.Types.ObjectId,ref:'Booking',required:true}, raisedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}, reason:{type:String,maxlength:2000}, status:{type:String,enum:['open','resolved'],default:'open'}, resolution:{type:String,maxlength:2000} },{timestamps:true});
module.exports={Audit:mongoose.model('Audit',audit),Dispute:mongoose.model('Dispute',dispute)};
