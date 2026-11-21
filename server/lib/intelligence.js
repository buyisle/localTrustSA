function reviewRisk(comment) {
 const signals=[]; const text=comment.trim();
 if (text.length<20) signals.push('Very short review; limited service detail');
 if (/https?:\/\/|www\./i.test(text)) signals.push('Contains an external link');
 if (/(.)\1{5,}/.test(text)) signals.push('Repeated character pattern');
 if (text.length>15 && text === text.toUpperCase() && /[A-Z]/.test(text)) signals.push('All-capitals text');
 return { riskScore: Math.min(100, signals.length*25), riskSignals: signals };
}
function rankProviders(services, { category, date, completed = new Map() } = {}) {
 const { availableAt }=require('./scheduling');
 const byProvider=new Map();
 for(const service of services) {
  if(!service.provider?._id || service.active === false) continue;
  if(date && !availableAt({ role:'provider',availability:service.availability }, date)) continue;
  const matches=category && service.category.toLowerCase()===category.toLowerCase();
  if(category && !matches) continue;
  const history=completed.get(String(service.provider._id)) || 0;
  const score=Math.round((matches?35:15)+(service.distance === undefined?0:20*Math.max(0,1-service.distance/50000))+(date?20:10)+(service.verified?10:0)+Math.min(5,service.rating||0)*2+Math.min(5,history));
  const result={ providerId:service.provider._id, serviceId:service._id, service, score, explanation:`${matches ? 'Matches your '+category+' request' : 'Offers a local service'}${service.distance !== undefined ? ', within your search radius' : ', serves '+service.location}${date ? ', available during your selected hours' : ''}${service.verified ? ', verified by the platform' : ''}${history ? ', with completed bookings in this category' : ''}. Final availability is checked when booking.` };
  const previous=byProvider.get(String(result.providerId));
  if(!previous || previous.score<score) byProvider.set(String(result.providerId),result);
 }
 return [...byProvider.values()].sort((a,b)=>b.score-a.score || String(a.providerId).localeCompare(String(b.providerId))).slice(0,5).map((result,index)=>({...result,rank:index+1}));
}
module.exports={reviewRisk,rankProviders};
