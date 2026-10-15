import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderPage, services, originalPaths } from './site.js';

export function validateLead(body) {
 if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Некорректная заявка.';
 if (body.website) return 'Некорректная заявка.';
 if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 80 || /[\x00-\x1f]/.test(body.name)) return 'Укажите имя от 2 до 80 символов.';
 if (typeof body.phone !== 'string' || body.phone.length > 30 || !/^[+\d\s()-]+$/.test(body.phone) || body.phone.replace(/\D/g,'').length < 10 || body.phone.replace(/\D/g,'').length > 15) return 'Проверьте номер телефона.';
 if (body.consent !== 'on') return 'Для отправки необходимо согласие на обработку данных.';
 if (body.message !== undefined && (typeof body.message !== 'string' || body.message.length > 1500)) return 'Сообщение должно быть не длиннее 1500 символов.';
 if (body.service && !services.some(s=>s.title===body.service)) return 'Выберите услугу из списка.';
 return null;
}
export function createApp({env=process.env,fetchImpl=fetch,now=Date.now}={}) {
 const siteUrl=new URL(env.SITE_URL || 'https://glav-buh.kz').origin;
 const ready=env.PUBLIC_SITE_READY==='true';
 const telegramConfigured=Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && ready);
 const buckets=new Map();
 const assets=new Map([['/style.css',['style.css','text/css; charset=utf-8']],['/app.js',['app.js','text/javascript; charset=utf-8']],['/calculator.js',['calculator.js','text/javascript; charset=utf-8']],['/pricing.js',['pricing.js','text/javascript; charset=utf-8']],['/logo-gb.png',['logo-gb.png','image/png']],['/astana-hub.svg',['astana-hub.svg','image/svg+xml']]]);
 const send=(res,code,body,type='application/json; charset=utf-8')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type.startsWith('application/json')?JSON.stringify(body):body)};
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if (!ready) res.setHeader('X-Robots-Tag','noindex, nofollow');
  try {
   const url=new URL(req.url,'http://localhost');
   const path=url.pathname;
   if(path==='/api/leads') {
    if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{message:'Используйте POST.'})}
    if(!telegramConfigured)return send(res,503,{message:'Приём заявок ещё не подключён. Попробуйте позже.'});
    if(req.headers.origin !== siteUrl)return send(res,403,{message:'Недопустимый источник запроса.'});
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return send(res,415,{message:'Ожидается JSON.'});
    // Trust the TCP peer only. Do not trust arbitrary X-Forwarded-For headers.
    const key=req.socket.remoteAddress;
    const time=now();
    for(const [ip,bucket] of buckets)if(time-bucket.start>=600000)buckets.delete(ip);
    const bucket=buckets.get(key)||{start:time,count:0};
    if(bucket.count>=5){res.setHeader('Retry-After',String(Math.max(1,Math.ceil((600000-time+bucket.start)/1000))));return send(res,429,{message:'Слишком много попыток. Попробуйте через несколько минут.'})}
    if(buckets.size>=10000&&!buckets.has(key))return send(res,503,{message:'Сервис занят. Попробуйте позже.'});
    bucket.count++;buckets.set(key,bucket);
    let body;
    if(req.body !== undefined) {
     // Vercel may have parsed the body before invoking the function.
     const serialized=typeof req.body==='string'?req.body:JSON.stringify(req.body);
     if(Buffer.byteLength(serialized)>8192)return send(res,413,{message:'Заявка слишком большая.'});
     try{body=JSON.parse(serialized)}catch{return send(res,400,{message:'Некорректная заявка.'})}
    } else {
     let size=0, chunks=[];
     for await (const chunk of req){size+=chunk.length;if(size>8192)return send(res,413,{message:'Заявка слишком большая.'});chunks.push(chunk)}
     try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return send(res,400,{message:'Некорректная заявка.'})}
    }
    const error=validateLead(body);
    if(error)return send(res,400,{message:error});
    const text=['Новая заявка · ГлавБух',`Имя: ${body.name.trim()}`,`Телефон: ${body.phone.trim()}`,`Услуга: ${body.service||'Помогите определиться'}`,`Задача: ${body.message?.trim()||'Не указана'}`,`Время UTC: ${new Date(now()).toISOString()}`].join('\n');
    try {
     const upstream=await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(12000)});
     const result=await upstream.json();
     if(!upstream.ok||result.ok!==true||!result.result?.message_id)throw new Error('delivery failed');
     return send(res,200,{message:'Заявка отправлена. Спасибо! Мы свяжемся с вами по указанному телефону.'});
    }catch{return send(res,502,{message:'Не удалось подтвердить доставку заявки. Пожалуйста, попробуйте позже.'})}
   }
   if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return send(res,405,{message:'Метод не поддерживается.'})}
   if(path==='/healthz')return send(res,200,{status:'ok',leads:telegramConfigured?'enabled':'disabled',indexing:ready});
   if(path==='/robots.txt')return send(res,200,ready?`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${siteUrl}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n','text/plain; charset=utf-8');
   if(path==='/sitemap.xml')return send(res,200,`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${(ready?['/','/calculator/',...originalPaths,...services.map(s=>`/uslugi/${s.slug}/`)]:[]).map(p=>`<url><loc>${siteUrl}${p}</loc></url>`).join('')}</urlset>`,'application/xml; charset=utf-8');
   if(/^\/fonts\/golos-text-(cyrillic|latin)-(400|500|600)-normal\.woff2$/.test(path)) { const data=await readFile(new URL(`../public${path}`,import.meta.url)); res.writeHead(200,{'Content-Type':'font/woff2','Cache-Control':'public, max-age=31536000, immutable'}); return res.end(req.method==='HEAD'?undefined:data); }
   if(assets.has(path)){
    const [name,type]=assets.get(path);
    const data=await readFile(new URL(`../public/${name}`,import.meta.url));
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=3600'});
    return res.end(req.method==='HEAD'?undefined:data);
   }
   if(path!=='/'&&!path.endsWith('/')&&!path.includes('.')){res.writeHead(308,{Location:path+'/'+url.search});return res.end()}
   const page=renderPage(path,{siteUrl,ready,telegramConfigured});
   send(res,page.found?200:404,req.method==='HEAD'?'':page.html,'text/html; charset=utf-8');
  }catch{send(res,500,{message:'Временная ошибка сервера.'})}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const server=createApp();
 const port=Number(process.env.PORT||3000);
 server.requestTimeout=20000;server.headersTimeout=15000;
 server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`ГлавБух: порт ${port}`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
