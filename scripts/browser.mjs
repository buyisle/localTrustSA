import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { createServer }=await import('../client/node_modules/vite/dist/node/index.js');
const root=path.resolve(import.meta.dirname,'..');
const artifacts=path.join(root,'.qa');await fs.mkdir(artifacts,{recursive:true});
const vite=await createServer({root:path.join(root,'client'),server:{host:'127.0.0.1',port:5175,strictPort:false}});await vite.listen();
const browserOrigin = 'http://127.0.0.1:' + vite.httpServer.address().port;
const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
let chromePath;for(const file of executable){try{await fs.access(file);chromePath=file;break;}catch{}}
if(!chromePath){await vite.close();console.log('SKIP: no local Chrome or Edge.');process.exit(0);}
const profile=path.join(artifacts,'browser-profile-'+Date.now());
const browser=spawn(chromePath,['--headless=new','--disable-gpu','--no-sandbox','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket;let sequence=0;const pending=new Map();const handlers=new Map();
try{
 const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Chrome startup timed out')),20000);browser.once('error',reject);browser.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 function command(method,params={},sessionId){const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},20000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 socket.onmessage=event=>{const packet=JSON.parse(event.data);if(packet.id){const task=pending.get(packet.id);pending.delete(packet.id);if(packet.error)task?.reject(Error(JSON.stringify(packet.error)));else task?.resolve(packet.result);}else for(const handler of handlers.get(packet.method)||[])handler(packet);};
 const {targetId}=await command('Target.createTarget',{url:'about:blank'});const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 const send=(method,params)=>command(method,params,sessionId);
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value;};
 const waitFor=async expression=>{const until=Date.now()+12000;while(Date.now()<until){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Condition timed out: '+expression);};
 const service={_id:'333333333333333333333333',title:'Tap repairs and leak detection',category:'Plumbing',description:'DEMO fictional service. Repairs and assessments; parts quoted separately.',price:450,location:'Benoni',demo:true,rating:0,reviewCount:0,provider:{_id:'222222222222222222222222',name:'Sipho Dlamini (DEMO)'},availability:{days:[1,2,3,4,5],startHour:8,endHour:17}};
 const listings = [service,
  {...service,_id:'333333333333333333333334',title:'Weekly home cleaning',category:'Cleaning',price:350,location:'Sandton'},
  {...service,_id:'333333333333333333333335',title:'Interior painting',category:'Painting',price:950,location:'Benoni'},
  {...service,_id:'333333333333333333333336',title:'Garden tidy up',category:'Gardening',price:400,location:'Midrand'}
 ];
 const testDay = new Date(Date.now() + 4 * 86400000 + 2 * 3600000).toISOString().slice(0, 10);
 const appointment = new Date(testDay + 'T09:30:00+02:00').toISOString();
 const customerId='111111111111111111111111',threadId='555555555555555555555555';
 const photo='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
 const photoName='11111111-1111-1111-1111-111111111111.png';
 const publicPhoto={url:'data:image/png;base64,'+photo,caption:'Kitchen tap installation'};
 let bookings=[];let posts=[];let role='customer';let inbox=[];let portfolio=[];let avatar='';const errors=[];let assistantRequest;
 handlers.set('Runtime.exceptionThrown',[packet=>errors.push(packet.params.exceptionDetails.text)]);
 handlers.set('Fetch.requestPaused',[async packet=>{const {requestId,request}=packet.params;let data=[];let status=200;const url=new URL(request.url);const pathname=url.pathname;const body=request.postData?JSON.parse(request.postData):{};
  if(pathname==='/api/auth/me')data={id:role==='provider'?service.provider._id:'111111111111111111111111',name:'QA User',email:'qa@example.test',role};
  else if(pathname==='/api/services'){
   const category=url.searchParams.get('category');
   data=category?listings.filter(item=>item.category===category):listings;
  }
  else if(pathname==='/api/services/my')data=[service];
  else if(pathname.endsWith('/reviews'))data=bookings.flatMap(item=>item.review?[{...item.review,customer:'QA User',createdAt:new Date().toISOString()}]:[]);
  else if(pathname.startsWith('/api/services/'))data={...service,portfolio:[publicPhoto],biography:'Local tap repair specialist.',experience:'Installation and maintenance.',offers:[listings[1]],reviewCount:1,rating:5};
  else if(pathname==='/api/marketplace/recommendations')data={recommendations:[{providerId:service.provider._id,serviceId:service._id,rank:1,score:50,explanation:'Matches Plumbing and serves Benoni.',service}]};
  else if(pathname.startsWith('/api/bookings/availability/'))data={slots:url.searchParams.get('day')===testDay?[appointment]:[]};
  else if(pathname==='/api/bookings'&&request.method==='POST'){posts.push(body);bookings=[{_id:'444444444444444444444444',service,customer:{name:'QA User'},provider:service.provider,bookingDate:body.bookingDate,status:'pending',agreedPrice:450,photos:body.photos?.length?[photoName]:[],timeline:[{_id:customerId,message:'Booking requested',bookingStatus:'pending',createdAt:new Date().toISOString()}]}];data={booking:bookings[0]};status=201;}
  else if(pathname.includes('/photos/')){await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:photo});return;}
  else if(pathname.includes('/email-preview/'))data={html:'<p>LocalTrustSA booking requested</p>'};
  else if(pathname.endsWith('/review')&&request.method==='POST'){bookings[0].review=body;data=body;status=201;}
  else if(pathname.endsWith('/status')&&request.method==='PATCH'){bookings=bookings.map(item=>({...item,status:body.status}));data=bookings[0];}
  else if(pathname.endsWith('/demo-payment')&&request.method==='POST'){bookings=bookings.map(item=>({...item,demoPayment:{method:body.method,status:'confirmed',reference:'DEMO-QA',serviceName:service.title,amount:450,paidAt:new Date().toISOString(),receiptStatus:'preview'}}));data=bookings[0].demoPayment;}
  else if(pathname.endsWith('/receipt-preview'))data={html:'<p>DEMO payment receipt</p>'};
  else if(pathname.endsWith('/payment')&&request.method==='POST'){bookings=bookings.map(item=>({...item,payment:{method:body.method,status:body.outcome,reference:'SIM-QA'}}));data=bookings[0].payment;}
  else if(pathname==='/api/bookings/my')data=bookings;
  else if(pathname==='/api/marketplace/assistant'){
   assistantRequest=body;
   if(body.history.length){status=503;data={message:'The AI assistant is temporarily unavailable.'};}
   else data={mode:'directory',reply:'Here are matching plumbing services.',services:[service]};
  }
  else if(pathname==='/api/marketplace/assistant/bookings')data={mode:'booking-status',reply:'Your bookings',bookings};
  else if(pathname==='/api/marketplace/profile')data={name:'QA Provider',location:'Benoni',availability:service.availability,portfolio,profilePhoto:avatar};
  else if(pathname==='/api/marketplace/portfolio'&&request.method==='POST'){assert.equal(body.data,photo);portfolio=[{...publicPhoto,caption:body.caption}];data=portfolio;status=201;}
  else if(pathname==='/api/marketplace/portfolio/profile-photo'){avatar=body.url;data={profilePhoto:avatar};}
  else if(pathname==='/api/messages'&&request.method==='POST')data={_id:threadId};
  else if(pathname==='/api/messages')data=[{_id:threadId,[role==='customer'?'provider':'customer']:{name:role==='customer'?'QA Provider':'QA Customer'}}];
  else if(pathname==='/api/messages/'+threadId&&request.method==='POST'){data={_id:String(inbox.length+1),sender:role==='customer'?customerId:service.provider._id,text:body.text,createdAt:new Date().toISOString()};inbox.push(data);status=201;}
  else if(pathname==='/api/messages/'+threadId)data={messages:inbox,hasMore:false};
  else if(pathname==='/api/marketplace/admin/overview')data={users:[],bookings:[],reviews:[],disputes:[],audit:[]};
  if(pathname.startsWith('/api/'))await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'X-Booking-Email-Mode',value:'preview'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});else await send('Fetch.continueRequest',{requestId});
 }]);
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setTimezoneOverride',{timezoneId:'America/Los_Angeles'});await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'}]});
 async function visit(route,currentRole='customer',width=1366){role=currentRole;await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await send('Page.navigate',{url:browserOrigin});await waitFor('document.readyState === "complete"');await evaluate(`localStorage.setItem('token','qa-token');localStorage.setItem('user',JSON.stringify(${JSON.stringify({id:currentRole==='provider'?service.provider._id:'111111111111111111111111',name:'QA User',email:'qa@example.test',role:currentRole})}));location.href=${JSON.stringify(route)};true`);await waitFor('document.readyState === "complete" && !!document.querySelector(".site-header")');}
 const screenshot=async name=>{const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await fs.writeFile(path.join(artifacts,name+'.png'),Buffer.from(data,'base64'));};
 const clickText=label=>evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent.includes('+JSON.stringify(label)+'))?.click()');
 const fill=(selector,value,type='HTMLInputElement')=>evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${type}.prototype,"value").set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event("input",{bubbles:true}));})()`);
 const selectPhoto=selector=>evaluate(`(()=>{const file=new File([Uint8Array.from(atob("${photo}"),value=>value.charCodeAt(0))],"repair.png",{type:"image/png"});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector(${JSON.stringify(selector)});input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));})()`);
 for(const width of [1366,390]){
  await visit('/','customer',width);await waitFor('document.querySelectorAll(".service-card").length === 4');assert.equal(await evaluate('new Set([...document.querySelectorAll(".service-card h3 a")].map(link=>link.href)).size'),4);assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'Homepage overflows at '+width);await screenshot('marketplace-'+width);
 }
 await evaluate('[...document.querySelectorAll(".category-card")].find(button=>button.textContent.includes("Plumbing")).click()');
 await waitFor('document.querySelectorAll(".service-card").length === 1 && document.querySelector(".service-card").textContent.includes("Tap repairs")');
 await evaluate('document.querySelector(".service-card button.button").click()');await waitFor('!!document.querySelector("dialog[open]")');
 const minDay=await evaluate('document.querySelector("dialog input[type=date]").min');assert.ok(minDay);
 const pastDay=new Date(Date.now()-86400000+2*3600000).toISOString().slice(0,10);
 const setDate=day=>evaluate('(()=>{const input=document.querySelector("dialog input[type=date]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,'+JSON.stringify(day)+');input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));})()');
 await setDate(pastDay);
 assert.equal(await evaluate('document.querySelector("dialog input[type=date]").validity.rangeUnderflow'),true);
 await evaluate('document.querySelector("dialog form").requestSubmit()');
 assert.equal(posts.length,0);
 await setDate(testDay);
 await waitFor('document.querySelector("dialog select option:last-child")?.value === '+JSON.stringify(appointment));
 await evaluate('(()=>{const select=document.querySelector("dialog select");select.selectedIndex=1;select.dispatchEvent(new Event("change",{bubbles:true}));})()');
 await selectPhoto('dialog input[type=file]');
 await waitFor('!!document.querySelector("dialog .booking-photo-grid img")');
 await evaluate('document.querySelector("dialog form").requestSubmit()');
 await waitFor('document.getElementById("booking-title").textContent === "Booking requested"');
 assert.equal(posts.length,1);assert.equal(posts[0].bookingDate,appointment);assert.deepEqual(posts[0].photos,[photo]);
 await evaluate('document.querySelector("dialog a").click()');
 await waitFor('location.pathname === "/dashboard"');
 await visit('/dashboard','customer',390);await waitFor('!!document.querySelector(".booking-card")');assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'Customer dashboard overflow');await screenshot('customer-mobile');
 await evaluate('document.querySelector(".booking-card details summary").click()');
 await waitFor('!!document.querySelector(".booking-photo-grid img")');
 await evaluate('document.querySelector(".booking-email-preview summary").click()');
 await clickText('Requested');
 await waitFor('document.querySelector(".booking-email-preview iframe")?.srcdoc.includes("booking requested")');
 await visit('/services/'+service._id,'customer',390);await waitFor('!!document.querySelector(".profile-grid")');assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'Profile overflow');await screenshot('profile-mobile');
 assert.match(await evaluate('document.querySelector(".profile-grid").textContent'),/Local tap repair specialist.*Kitchen tap installation/s);
 await clickText('Message provider');
 await waitFor('!!document.querySelector(".inbox-compose")');
 await fill('.inbox-compose textarea','Can you repair the kitchen tap?','HTMLTextAreaElement');
 await clickText('Send');
 await waitFor('document.querySelector(".inbox-history")?.textContent.includes("Can you repair")');
 await visit('/messages/'+threadId,'provider',390);
 await waitFor('document.querySelector(".inbox-history")?.textContent.includes("Can you repair")');
 await fill('.inbox-compose textarea','Yes, please choose a slot.','HTMLTextAreaElement');
 await clickText('Send');
 await waitFor('document.querySelector(".inbox-history")?.textContent.includes("choose a slot")');
 assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'Inbox overflows');
 await visit('/messages/'+threadId,'customer',390);
 await waitFor('document.querySelector(".inbox-history")?.textContent.includes("choose a slot")');
 await visit('/services/'+service._id,'customer',390);
 await evaluate('document.querySelector(".assistant-launch").click()');await waitFor('!!document.querySelector(".assistant-panel")');assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),'Chat overflow');await screenshot('assistant-mobile');
 await evaluate('document.querySelector(".chat-suggestions button").click()');
 await waitFor('document.querySelector(".chat-message.assistant")?.textContent.includes("plumbing services")');
 assert.equal(await evaluate('document.querySelector(".chat-service").getAttribute("href")'),'/services/'+service._id);
 assert.match(await evaluate('document.querySelector(".chat-service").textContent'),/Sipho.*Benoni/);
 assert.ok(await evaluate('document.querySelector(".assistant-panel").getBoundingClientRect().left >= 0 && document.querySelector(".assistant-panel").getBoundingClientRect().right <= innerWidth'));
 await evaluate(`(() => { const input = document.querySelector(".assistant-panel input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"Benoni"); input.dispatchEvent(new Event("input",{bubbles:true})); })()`);
 await evaluate('document.querySelector(".assistant-panel form button").click()');
 await waitFor('document.querySelector(".chat-error")?.textContent.includes("temporarily unavailable")');
 assert.deepEqual(assistantRequest.history.map(turn=>turn.role),['user','assistant']);
 assert.equal(await evaluate('document.querySelectorAll(".chat-service").length'),1);
 await evaluate('document.querySelector("[aria-label=\'Clear conversation\']").click()');
 await waitFor('!!document.querySelector(".chat-welcome") && !document.querySelector(".chat-error")');
 await visit('/dashboard','provider',1366);await waitFor('!!document.querySelector(".settings-panel")');assert.match(await evaluate('document.body.innerText'),/Profile & availability/);await screenshot('provider-desktop');
 await evaluate('document.querySelector(".booking-card details summary").click()');
 await waitFor('!!document.querySelector(".booking-photo-grid img")');
 await selectPhoto('.settings-panel input[type=file]');
 await fill('.settings-panel input[placeholder^="e.g. Recently"]','Portfolio browser fixture');
 await clickText('Publish portfolio photo');
 await waitFor('document.querySelector(".portfolio-grid")?.textContent.includes("Portfolio browser fixture")');
 await clickText('Use as profile photo');
 await waitFor('document.querySelector(".portfolio-grid")?.textContent.includes("Current profile photo")');
 await evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent.includes("Accept booking")).click()');await waitFor('document.querySelector(".booking-card .status").textContent.includes("confirmed")');
 await visit('/dashboard','customer',390);
 await waitFor('document.body.innerText.includes("Open DEMO checkout")');
 await clickText('Open DEMO checkout');
 await waitFor('Boolean(document.querySelector("dialog[open]"))');
 await clickText('Confirm DEMO payment');
 await waitFor('document.querySelector("dialog").innerText.includes("DEMO-QA")');
 await clickText('Preview receipt email');
 await waitFor('Boolean(document.querySelector("iframe.demo-email-preview"))');
 assert.equal(bookings[0].demoPayment.method,'demo-card');
 bookings[0].status='completed';
 await visit('/dashboard','customer',390);
 await waitFor('document.querySelector(".booking-actions")?.textContent.includes("Leave a review")');
 await clickText('Leave a review');
 await fill('.booking-actions textarea','The tap was fixed and the work area was tidy.','HTMLTextAreaElement');
 await clickText('Submit review');
 await waitFor('document.querySelector(".review-quote")?.textContent.includes("work area was tidy")');
 await visit('/services/'+service._id,'customer',390);
 await waitFor('document.querySelector(".profile-grid")?.textContent.includes("Read approved reviews")');
 await clickText('Read approved reviews');
 await waitFor('document.querySelector("dialog .review-quote")?.textContent.includes("work area was tidy")');
 await visit('/dashboard','admin',390);await waitFor('!!document.querySelector(".admin-list")');assert.match(await evaluate('document.body.innerText'),/Administrator dashboard/);await screenshot('admin-mobile');
 assert.deepEqual(errors,[]);console.log('PASS: responsive directory, portfolios, booking photo selection and participant display, booking email preview, two-way inbox, review submission and display, assistant, booking, DEMO payment and role dashboards.');console.log('Screenshots: .qa/*.png. Browser API fixtures are isolated; no database writes or paid calls.');
}catch(error){console.error(error);process.exitCode=1;}finally{try{socket?.send(JSON.stringify({id:++sequence,method:'Browser.close'}));socket?.close();}catch{}browser.kill();await vite.close();}

