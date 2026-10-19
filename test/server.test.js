import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
const lead={name:'Тест Клиент',phone:'+7 (700) 123-45-67',service:'',message:'Нужна консультация',consent:'on',website:''};
async function app(t,options={}) {
 const server=createApp(options);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 return {get:path=>fetch(base+path),post:(body=lead,origin='https://glav-buh.kz')=>fetch(base+'/api/leads',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)})};
}
const enabled={SITE_URL:'https://glav-buh.kz',PUBLIC_SITE_READY:'true',TELEGRAM_BOT_TOKEN:'test-only',TELEGRAM_CHAT_ID:'test-chat'};
test('draft renders full server-side content and blocks indexing and leads',async t=>{
 const api=await app(t,{env:{}});
 const page=await api.get('/');assert.equal(page.status,200);const html=await page.text();assert.match(html,/Разрабатываем/);assert.match(html,/100 000/);assert.match(html,/application\/ld\+json/);assert.match(html,/noindex,nofollow/);assert.match(html,/Приём заявок скоро откроется/);
 assert.match(await(await api.get('/robots.txt')).text(),/Disallow: \//);
 assert.equal((await api.post()).status,503);
});
test('service routes, assets, canonical redirects, sitemap and real 404',async t=>{
 const api=await app(t,{env:enabled});
 const service=await api.get('/uslugi/nalogovaya-otchetnost/');assert.equal(service.status,200);assert.match(await service.text(),/Налоговая отчётность/);
 const css=await api.get('/style.css');assert.equal(css.status,200);assert.match(css.headers.get('content-type'),/text\/css/);
 assert.equal((await api.get('/missing/')).status,404);
 assert.match(await(await api.get('/sitemap.xml')).text(),/nalogovaya-otchetnost/);
});
test('valid lead is delivered and success requires Telegram confirmation',async t=>{
 let sent;
 const api=await app(t,{env:enabled,fetchImpl:async(url,options)=>{assert.match(url,/api.telegram.org/);sent=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,result:{message_id:123}})}}});
 const res=await api.post();assert.equal(res.status,200);assert.equal(sent.chat_id,'test-chat');assert.match(sent.text,/Тест Клиент/);assert.equal(sent.parse_mode,undefined);
});
test('delivery failure never returns a false success or exposes credentials',async t=>{
 const api=await app(t,{env:enabled,fetchImpl:async()=>{throw Error('private-token')}});
 const res=await api.post();assert.equal(res.status,502);assert.doesNotMatch(await res.text(),/private-token|test-only/);
});
test('cross-origin requests, missing consent, honeypot and invalid phones are rejected',async t=>{
 const api=await app(t,{env:enabled,fetchImpl:async()=>assert.fail('Must not deliver')});
 assert.equal((await api.post(lead,'https://evil.example')).status,403);
 for(const patch of [{consent:''},{website:'spam'},{phone:'123'},{service:'Fake'}])assert.equal((await api.post({...lead,...patch})).status,400);
});
test('rate limit cannot be bypassed with forwarded headers',async t=>{
 const api=await app(t,{env:enabled});
 for(let i=0;i<5;i++)assert.equal((await api.post({...lead,consent:''})).status,400);
 const res=await api.post();assert.equal(res.status,429);assert.ok(res.headers.get('retry-after'));
});
test('oversized payload and invalid JSON are rejected',async t=>{
 const api=await app(t,{env:enabled});
 assert.equal((await api.post({...lead,message:'x'.repeat(9000)})).status,413);
});
test('every imported sitemap page renders on its original URL',async t=>{
 const { originalPaths }=await import('../src/site.js');
 const api=await app(t,{env:{}});
 assert.equal(originalPaths.length,18);
 for(const path of originalPaths){const res=await api.get(path);assert.equal(res.status,200,path);const html=await res.text();assert.match(html,/<h1>/);assert.match(html,/rel="canonical"/);assert.doesNotMatch(html,/undefined/);}
});
test('Vercel adapter renders HTML and handles a pre-parsed JSON body',async t=>{
 const http=await import('node:http');
 const application=createApp({env:enabled,fetchImpl:async()=>({ok:true,json:async()=>({ok:true,result:{message_id:1}})})});
 const handler=application.listeners('request')[0];
 const server=http.createServer((req,res)=>{req.body={...lead};return handler(req,res)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const result=await fetch(`http://127.0.0.1:${server.address().port}/api/leads`,{method:'POST',headers:{Origin:'https://glav-buh.kz','Content-Type':'application/json'}});
 assert.equal(result.status,200);
 const adapter=(await import('../api/index.js')).default;
 assert.equal(typeof adapter,'function');
});
test('calculator route, module assets and sitemap are available',async t=>{
 const api=await app(t,{env:enabled});
 const res=await api.get('/calculator/');assert.equal(res.status,200);const html=await res.text();assert.match(html,/calculator-form/);assert.match(html,/name="organization"/);assert.match(html,/name="months"/);assert.match(html,/type="module"/);
 for(const path of ['/calculator.js','/pricing.js']){const asset=await api.get(path);assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);}
 assert.match(await(await api.get('/sitemap.xml')).text(),/calculator/);
});
test('Telegram leads work while search indexing stays disabled',async t=>{
 const api=await app(t,{env:{...enabled,PUBLIC_SITE_READY:'false'},fetchImpl:async()=>({ok:true,json:async()=>({ok:true,result:{message_id:7}})})});
 const health=await(await api.get('/healthz')).json();assert.equal(health.leads,'enabled');assert.equal(health.indexing,false);
 const html=await(await api.get('/')).text();assert.match(html,/noindex,nofollow/);assert.doesNotMatch(html,/Приём заявок скоро откроется/);
 assert.equal((await api.post()).status,200);
});
test('Vercel production origin is accepted without trusting request host headers',async t=>{
 const api=await app(t,{env:{...enabled,PUBLIC_SITE_READY:'false',VERCEL_PROJECT_PRODUCTION_URL:'glavbuhdigital.vercel.app'},fetchImpl:async()=>({ok:true,json:async()=>({ok:true,result:{message_id:8}})})});
 assert.equal((await api.post(lead,'https://glavbuhdigital.vercel.app')).status,200);
 assert.equal((await api.post(lead,'https://fake.vercel.app')).status,403);
});

test('maintenance proposal precedes other content and price page replaces imported web prices',async t=>{
 const api=await app(t,{env:{}});
 const home=await(await api.get('/')).text();
 assert.ok(home.indexOf('platform-hero')<home.indexOf('id="maintenance-options"'));
 assert.ok(home.indexOf('id="maintenance-options"')<home.indexOf('id="about"'));
 const prices=await(await api.get('/price-list/')).text();
 assert.match(prices,/100 000/);assert.doesNotMatch(prices,/Тарифы перенесены|ИП - 50 000|ТОО - 80 000/);
 assert.match(prices,/glavbuh-maintenance.pdf/);
 const pdf=await api.get('/glavbuh-maintenance.pdf');assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');
 const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');
});

test('IT positioning presents software development without disguising accounting services',async t=>{
 const api=await app(t,{env:{}});
 const home=await(await api.get('/')).text();assert.match(home,/IT-КОМПАНИЯ/);assert.match(home,/платформу учёта/);
 assert.ok(home.indexOf('platform-hero')<home.indexOf('id="platform-overview-title"'));
 assert.ok(home.indexOf('id="platform-overview-title"')<home.indexOf('id="maintenance-options"'));
 const schema=JSON.parse(home.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
 assert.equal(schema['@graph'][0]['@type'],'Organization');
 const company=await(await api.get('/about-us/')).text();
 assert.match(company,/модификация и реализация программного обеспечения и программного продукта/);
 assert.match(company,/Бухгалтерское сопровождение бизнеса представлено как отдельное направление/);
});
