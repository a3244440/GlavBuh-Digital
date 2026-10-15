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
 const page=await api.get('/');assert.equal(page.status,200);const html=await page.text();assert.match(html,/Ваш бизнес/);assert.match(html,/application\/ld\+json/);assert.match(html,/noindex,nofollow/);assert.match(html,/Приём заявок скоро откроется/);
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
