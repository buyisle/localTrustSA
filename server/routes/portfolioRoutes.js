const router=require('express').Router();
const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
const User=require('../models/User');const {protect}=require('../Middleware/authMiddleware');const {portfolioImage}=require('../lib/portfolio');
const uploadRoot=path.resolve(__dirname,'../uploads');
router.use(protect,(req,res,next)=>{if(req.user.role!=='provider')return res.status(403).json({message:'Only providers can manage a portfolio.'});next();});
router.post('/',async(req,res)=>{
 if(typeof req.body.caption!=='string'||req.body.caption.length>160)return res.status(400).json({message:'Add a caption of up to 160 characters.'});
 let image;try{image=portfolioImage(req.body.data);}catch(error){return res.status(400).json({message:error.message});}
 if((req.user.portfolio?.length||0)>=12)return res.status(409).json({message:'Your portfolio can contain up to 12 photos.'});
 const filename=String(req.user._id)+'-'+crypto.randomUUID()+'.'+image.extension;
 const target=path.resolve(uploadRoot,filename);if(!target.startsWith(uploadRoot+path.sep))throw Error('Invalid upload path.');
 await fs.mkdir(uploadRoot,{recursive:true});await fs.writeFile(target,image.bytes,{flag:'wx'});
 const item={url:'/uploads/'+filename,caption:req.body.caption.trim()};
 let user;
 try {
  user=await User.findOneAndUpdate({_id:req.user._id,'portfolio.11':{$exists:false}},{$push:{portfolio:item}},{new:true,runValidators:true});
 } catch (error) {
  await fs.unlink(target).catch(() => {});
  throw error;
 }
 if(!user){await fs.unlink(target);return res.status(409).json({message:'Portfolio is full. Refresh and remove a photo before uploading.'});}
 res.status(201).json(user.portfolio);
});
router.patch('/profile-photo',async(req,res)=>{
 const {url}=req.body;
 if(typeof url!=='string')return res.status(400).json({message:'Choose a portfolio photo.'});
 const user=await User.findOneAndUpdate({_id:req.user._id,'portfolio.url':url},{$set:{profilePhoto:url}},{new:true});
 if(!user)return res.status(404).json({message:'Photo not found in your portfolio.'});
 res.json({profilePhoto:user.profilePhoto});
});
router.delete('/:filename',async(req,res)=>{
 const filename=req.params.filename;
 if(!new RegExp('^'+String(req.user._id)+'-[a-f0-9-]{36}\\.(jpg|png|webp)$').test(filename))return res.status(400).json({message:'Invalid portfolio photo.'});
 const target=path.resolve(uploadRoot,filename);if(!target.startsWith(uploadRoot+path.sep))throw Error('Invalid upload path.');
 const user=await User.findOneAndUpdate({_id:req.user._id,'portfolio.url':'/uploads/'+filename},{$pull:{portfolio:{url:'/uploads/'+filename}}},{new:true});
 if(!user)return res.status(404).json({message:'Photo not found in your portfolio.'});
 await User.updateOne({_id:req.user._id,profilePhoto:'/uploads/'+filename},{$set:{profilePhoto:''}});
 await fs.unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error;});res.json(user.portfolio);
});
module.exports=router;
