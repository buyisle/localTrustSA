import { useEffect, useState } from 'react';
import api from '../Services/api';
import { errorMessage } from '../lib/marketplace';
import { Notice } from './UI';
type Notification={id:string;message:string;createdAt:string;read:boolean;service?:string};
export default function Notifications({revision}:{revision:number}){
 const [items,setItems]=useState<Notification[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState('');
 useEffect(()=>{const controller=new AbortController();api.get<Notification[]>('/marketplace/notifications',{signal:controller.signal}).then(({data})=>{setItems(data);setError('');}).catch(err=>{if(!controller.signal.aborted)setError(errorMessage(err,'Unable to load notifications.'));});return()=>controller.abort();},[revision]);
 async function read(id:string){setBusy(id);try{await api.patch(`/marketplace/notifications/${id}/read`);setItems(values=>values.map(item=>item.id===id?{...item,read:true}:item));}catch(err){setError(errorMessage(err,'Unable to mark notification read.'));}finally{setBusy('');}}
 return <section className="panel notifications-panel"><div className="section-heading"><h2>Notifications</h2><span className="category-tag teal">{items.filter(item=>!item.read).length} unread</span></div>{error&&<Notice>{error}</Notice>}{!items.length&&!error&&<p className="subtle">Booking, payment and review updates will appear here.</p>}<div className="notification-list">{items.slice(0,12).map(item=><article className={item.read?'notification read':'notification'} key={item.id}><div><strong>{item.service||'Booking update'}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</small></div>{!item.read&&<button className="text-button" disabled={busy===item.id} onClick={()=>read(item.id)}>Mark read</button>}</article>)}</div></section>;
}
