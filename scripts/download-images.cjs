// Downloads optional stock assets locally. Never used automatically by the app.
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sources={plumbing:6419128,electrical:8005368,cleaning:4239031,painting:6474471,beauty:3993449,gardening:4503269,carpentry:5974389,handyman:4489732};
(async()=>{
 const available=[];await fs.promises.mkdir(path.join(root,'client/public/images'),{recursive:true});
 for(const [name,id] of Object.entries(sources)){
  const url=`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900`;
  try{const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('Not an available photo.');const bytes=Buffer.from(await response.arrayBuffer());if(bytes[0]!==0xff||bytes[1]!==0xd8)throw Error('Not a JPEG.');await fs.promises.writeFile(path.join(root,`client/public/images/${name}.jpg`),bytes);available.push(`/images/${name}.jpg`);console.log(`${name}: downloaded; check subject and cropping before publishing.`);}catch{console.log(`${name}: download unavailable; fallback retained.`);}
 }
 // Preserve previous successfully downloaded images when a later attempt is offline.
 const manifestPath=path.join(root,'client/src/assets/service-images.json');const previous=JSON.parse((await fs.promises.readFile(manifestPath,'utf8')).replace(/^\uFEFF/,''));
 const existing=[];for(const file of previous.available||[])try{await fs.promises.access(path.join(root,'client/public',file));existing.push(file);}catch{}
 await fs.promises.writeFile(manifestPath,JSON.stringify({available:[...new Set([...existing,...available])]},null,2)+'\n');
 if(!available.length)process.exitCode=1;
})();
