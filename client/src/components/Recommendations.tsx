import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../Services/api';
import type { Service } from '../types';
import { money } from '../lib/marketplace';
type Recommendation={providerId:string;serviceId:string;rank:number;score:number;explanation:string;service:Service};
export default function Recommendations({category,location}: {category:string;location:string}) {
 const [items,setItems]=useState<Recommendation[]>([]);const [state,setState]=useState('loading');
 useEffect(()=>{const controller=new AbortController();const timer=setTimeout(()=>{setState('loading');api.get<{recommendations:Recommendation[]}>('/marketplace/recommendations',{params:{category:category||undefined,location:location||undefined},signal:controller.signal}).then(({data})=>{setItems(data.recommendations);setState('ready');}).catch(()=>{if(!controller.signal.aborted)setState('error');});},300);return()=>{clearTimeout(timer);controller.abort();};},[category,location]);
 return <section className="recommendation-section"><div className="section-heading"><div><p className="eyebrow">A LITTLE HELP CHOOSING</p><h2>Recommended for your search</h2><p className="subtle">Explainable weighted matching · ratings, location and completed bookings · no trained model</p></div></div>{state==='loading'?<p role="status">Finding matching providers...</p>:state==='error'?<p className="subtle">Recommendations are unavailable. You can still browse the directory below.</p>:!items.length?<p className="subtle">No eligible providers match this search yet.</p>:<div className="recommendation-grid">{items.slice(0,3).map(item=><Link className="recommendation-card" key={item.providerId} to={`/services/${item.serviceId}`}><span className="category-tag teal">#{item.rank} · {item.score}/100 match</span><h3>{item.service.provider?.name}</h3><strong>{item.service.title}</strong><p>{item.explanation}</p><span>{money(item.service.price)} · View provider</span></Link>)}</div>}</section>;
}
