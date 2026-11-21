function portfolioImage(value){
 if(typeof value!=='string'||value.length>1400000||!value.length||value.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Choose a valid JPEG, PNG or WebP photo up to 1 MB.');
 const bytes=Buffer.from(value,'base64');if(bytes.length>1024*1024)throw Error('Photo must be 1 MB or smaller.');
 let extension;
 if(bytes.length>=12&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)extension='jpg';
 else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))extension='png';
 else if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')extension='webp';
 if(!extension)throw Error('Only JPEG, PNG or WebP photos are supported.');
 return {bytes,extension};
}
module.exports={portfolioImage};
