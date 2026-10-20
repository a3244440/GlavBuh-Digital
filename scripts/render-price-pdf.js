import {writeFileSync,mkdirSync,statSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {chromium} from 'playwright';
import {maintenanceOffers} from '../src/maintenance.js';
import {priorityActivity} from '../src/platform.js';
import {includedServices} from '../src/tariff-benefits.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const money=n=>n.toLocaleString('ru-RU').replace(/ /g,' ');
const font=(family,file,weight,range)=>`@font-face{font-family:'${family}';src:url('../public/fonts/${file}.woff2') format('woff2');font-weight:${weight};unicode-range:${range}}`;
const cyr='U+0400-04FF,U+2116',lat='U+0000-00FF,U+2000-206F,U+2212',ext='U+0100-02FF,U+20A0-20C0';
const steps=[['Знакомимся','Вы рассказываете о бизнесе, мы определяем задачу.'],['Разбираемся','Изучаем данные, согласуем объём и условия.'],['Берём в работу','Выстраиваем передачу документов и связь.'],['Держим в курсе','Результаты и следующие шаги на платформе.']];
const header=label=>`<header><img src="../public/logo-gb.png" alt="ГлавБух"><span class="mono">${label}</span></header>`;
const footer=(left,n)=>`<footer><span>${left}</span><span class="mono">${n} / 02</span></footer>`;
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>ГлавБух | Коммерческое предложение</title><style>
${font('Golos','golos-text-cyrillic-400-normal',400,cyr)}${font('Golos','golos-text-latin-400-normal',400,lat)}${font('Golos','golos-text-cyrillic-500-normal',500,cyr)}${font('Golos','golos-text-latin-500-normal',500,lat)}
${font('Geologica','geologica-cyrillic','300 700',cyr)}${font('Geologica','geologica-latin','300 700',lat)}${font('Geologica','geologica-latin-ext','300 700',ext)}
${font('Martian','martian-mono-cyrillic','400 500',cyr)}${font('Martian','martian-mono-latin','400 500',lat)}
@page{size:A4;margin:0}
*{box-sizing:border-box}
:root{--bg:#F3F4F6;--surface:#fff;--ink:#10151C;--muted:#636C79;--line:#E0E4E9;--red:#E1232B;--ok:#1E9A60}
body{margin:0;font-family:Golos,Arial,sans-serif;color:var(--ink);background:var(--bg);font-size:9.5pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{height:297mm;width:210mm;padding:14mm 15mm 0;position:relative;overflow:hidden;break-after:page;display:flex;flex-direction:column}
.sheet:last-child{break-after:auto}
p{margin:0}a{color:inherit;text-decoration:none}
.mono{font-family:Martian,ui-monospace,monospace;font-size:6.6pt;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.d{font-family:Geologica,Golos,Arial,sans-serif;letter-spacing:-.04em}
header{display:flex;justify-content:space-between;align-items:center}
header img{width:36mm;height:auto}
.pill{align-self:flex-start;display:inline-flex;align-items:center;gap:2mm;padding:1.4mm 3mm 1.4mm 2mm;border-radius:99px;background:var(--surface);box-shadow:0 0 0 .25mm var(--line);margin-top:12mm}
.pill i{width:2mm;height:2mm;border-radius:50%;background:var(--ok)}
h1{font:500 34pt/1 Geologica,Golos,sans-serif;letter-spacing:-.045em;margin:5mm 0 5mm}
h1 b,h2 b{color:var(--red);font-weight:700}
.lead{font-size:10.5pt;color:var(--muted);max-width:150mm}
.box{background:var(--surface);border-radius:4.5mm;box-shadow:0 0 0 .25mm var(--line)}
.band{margin-top:8mm;background:var(--ink);color:#fff;border-radius:4.5mm;padding:7mm 8mm;display:grid;grid-template-columns:1fr 1.15fr;gap:8mm;align-items:center}
.band .mono{color:#AEB6C2}
.band .price{font:700 30pt/1 Geologica,sans-serif;letter-spacing:-.05em;margin-top:3mm;white-space:nowrap}
.band .price small{display:block;margin-top:2mm;font:400 10pt Golos,sans-serif;letter-spacing:0;color:#AEB6C2}
.facts{display:grid;gap:2mm}
.facts div{display:flex;gap:3mm;align-items:center;padding:2.6mm 3.4mm;border-radius:3mm;background:#1C2430;font-size:9pt}
.facts b{flex:none;width:5.5mm;height:5.5mm;border-radius:50%;background:var(--red);display:grid;place-items:center;font:500 7pt Martian,monospace}
.label{margin:8mm 0 3.5mm;display:flex;justify-content:space-between;align-items:baseline}
.label h2{font:500 17pt/1.1 Geologica,sans-serif;letter-spacing:-.04em;margin:0}
.offers{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.offer{padding:5.5mm;display:flex;flex-direction:column;gap:2.2mm}
.offer.hl{box-shadow:0 0 0 .55mm var(--ink)}
.offer h3{font:500 12.5pt/1.2 Geologica,sans-serif;letter-spacing:-.03em;margin:0}
.offer .p{font:700 18pt/1 Geologica,sans-serif;letter-spacing:-.05em;color:var(--ink)}
.offer .p small{font:400 8pt Golos,sans-serif;color:var(--muted);letter-spacing:0}
.offer p{font-size:8.3pt;color:var(--muted)}
.ticks{list-style:none;margin:1mm 0 0;padding:0;display:grid;gap:1.4mm;font-size:8.3pt}
.ticks li{display:grid;grid-template-columns:3.5mm 1fr;gap:1.5mm}
.ticks li::before{content:"✓";color:var(--ok);font-weight:500}
.fine{font-size:7.3pt;color:var(--muted);line-height:1.6;margin-top:5mm}
footer{margin-top:auto;padding:4mm 0 9mm;border-top:.25mm solid var(--line);display:flex;justify-content:space-between;font-size:7.5pt;color:var(--muted)}
.inc{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.inc article{padding:4.2mm 4.5mm}
.second .label{margin-top:6mm}
.second header + .label{margin-top:8mm}
.inc .n{font:500 7pt Martian,monospace;color:var(--red)}
.inc h3{font:500 11pt/1.2 Geologica,sans-serif;letter-spacing:-.03em;margin:2mm 0 1.5mm}
.inc p{font-size:8.2pt;color:var(--muted)}
.team{margin-top:3mm;padding:4.5mm 6mm;display:flex;justify-content:space-between;align-items:center;gap:4mm}
.team > div:first-child{min-width:0}
.team h3{font:500 13pt Geologica,sans-serif;letter-spacing:-.03em;margin:1.5mm 0 0}
.roles{display:flex;gap:1.6mm;flex:none}
.roles span{display:inline-flex;align-items:center;gap:1.6mm;padding:1.6mm 2.4mm 1.6mm 1.6mm;border-radius:3mm;background:var(--bg);font-size:7.8pt;font-weight:500;white-space:nowrap}
.roles i{width:6mm;height:6mm;border-radius:50%;background:var(--ink);color:#fff;font:500 6pt/6mm Martian,monospace;text-align:center;font-style:normal}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}
.steps article{padding:4.5mm}
.steps h3{font:500 11pt Geologica,sans-serif;letter-spacing:-.03em;margin:1.5mm 0 1mm}
.steps p{font-size:8pt;color:var(--muted)}
.contact{margin-top:6mm;display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.contact .red{background:var(--red);color:#fff;border-radius:4.5mm;padding:6mm}
.contact .red .mono{color:#FFD3D5}
.contact .red h2{font:500 19pt/1.08 Geologica,sans-serif;letter-spacing:-.04em;margin:2.5mm 0 2.5mm}
.contact .red p{color:#FFE7E8;font-size:9pt}
.kv{padding:3mm 6mm}
.kv div{display:flex;justify-content:space-between;gap:4mm;padding:2mm 0;border-bottom:.25mm solid var(--line);font-size:9pt}
.kv div:last-child{border-bottom:0}
.kv span{color:var(--muted)}
.kv b{font-weight:500}
</style></head><body>
<section class="sheet">${header('Коммерческое предложение · '+new Date().getFullYear())}
<span class="pill mono"><i></i>IT-компания · участник Astana Hub</span>
<h1>Бухгалтерия на платформе, <b>которую видно.</b></h1>
<p class="lead">ГлавБух разрабатывает собственную платформу автоматизации учёта и ведёт на ней бухгалтерию ИП и ТОО. Каждая задача, срок и документ зафиксированы, а за компанией закреплена команда специалистов.</p>
<div class="band"><div><span class="mono">Бухгалтерское сопровождение с использованием платформы</span><p class="price">от ${money(100000)} ₸ <small>в месяц</small></p></div><div class="facts"><div><b>1</b>Проверка кабинета налогоплательщика 2 раза в неделю</div><div><b>2</b>База 1С и техническая поддержка в тарифе</div><div><b>3</b>2-3 закреплённых специалиста</div></div></div>
<div class="label"><h2>Три формата <b>сопровождения</b></h2><span class="mono">Цены в тенге за месяц</span></div>
<div class="offers">${maintenanceOffers.map((o,i)=>`<article class="offer box${i===1?' hl':''}"><span class="mono">0${i+1} / ${o.tag}</span><h3>${o.name}</h3><p class="p">от ${money(o.price)} <small>₸ / мес</small></p><p>${o.text}</p><ul class="ticks">${o.points.map(p=>`<li>${p}</li>`).join('')}</ul></article>`).join('')}</div>
<p class="fine">Итоговая стоимость зависит от налогового режима, вида деятельности, числа сотрудников, счетов-фактур, платежей и банковских выписок, импорта и экспорта. Разовые услуги и восстановление учёта (от 150 000 ₸ за проект) рассчитываются отдельно. Состав работ и стоимость фиксируются в договоре. Предварительное предложение, не публичная оферта.</p>
${footer('ТОО «ГлавБух» · glav-buh.kz','01')}</section>
<section class="sheet second">${header('Состав сопровождения и контакты')}
<div class="label"><h2>Включено в <b>Standard и Gold</b></h2><span class="mono">Ежемесячно</span></div>
<div class="inc">${includedServices.map(([n,t,d])=>`<article class="box"><span class="n">${n}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
<div class="team box"><div><span class="mono">2-3 сотрудника</span><h3>Команда под ваш учёт</h3></div><div class="roles"><span><i>ОП</i>Операционист</span><span><i>РО</i>Руководитель отдела</span><span><i>СБ</i>Старший бухгалтер</span></div></div>
<div class="label"><h2>Как <b>начинаем работу</b></h2><span class="mono">4 шага</span></div>
<div class="steps">${steps.map(([t,d],i)=>`<article class="box"><span class="mono">Шаг ${i+1}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
<div class="contact"><div class="red"><span class="mono">Следующий шаг</span><h2>Рассчитаем стоимость под ваш бизнес.</h2><p>Позвоните или напишите: подберём формат и подготовим предложение.</p></div><div class="kv box"><div><span>Телефон</span><b><a href="tel:+77075520000">+7 (707) 552 00 00</a></b></div><div><span>Телефон</span><b><a href="tel:+77087060000">+7 (708) 706 00 00</a></b></div><div><span>Почта</span><b><a href="mailto:info@glav-buh.kz">info@glav-buh.kz</a></b></div><div><span>Офисы</span><b>Астана, Абая 80 и Абая 97</b></div><div><span>Кабинет</span><b><a href="https://cabinet.glav-buh.kz/">cabinet.glav-buh.kz</a></b></div></div></div>
<p class="fine"><b>Направление IT-деятельности:</b> ${priorityActivity.toLowerCase()}. Бухгалтерское сопровождение оказывается как отдельное направление с использованием платформы; условия использования программного продукта согласуются в отдельных предложениях и договорах.</p>
${footer('ГлавБух: разработка ПО и бухгалтерское сопровождение','02')}</section>
</body></html>`;
mkdirSync(resolve(root,'docs'),{recursive:true});
const source=resolve(root,'docs/maintenance-price.html');writeFileSync(source,html);
if(process.argv.includes('--html-only')){console.log(source);process.exit(0)}
const server=http.createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;if(path!=='/docs/maintenance-price.html'&&!/^\/public\/(logo-gb\.png|fonts\/(golos-text-(cyrillic|latin)-(400|500)-normal|geologica-(cyrillic|latin|latin-ext)|martian-mono-(cyrillic|latin))\.woff2)$/.test(path)){res.writeHead(404);return res.end()}try{res.setHeader('Content-Type',path.endsWith('.woff2')?'font/woff2':path.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(readFileSync(resolve(root,'.'+path)))}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${server.address().port}/docs/maintenance-price.html`,{waitUntil:'load'});
 await page.evaluate(()=>document.fonts.ready);
 const bytes=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
 if(bytes.subarray(0,4).toString()!=='%PDF')throw Error('Invalid PDF output');
 const output=resolve(root,'public/glavbuh-maintenance.pdf');writeFileSync(output,bytes);
 console.log(output,statSync(output).size,'bytes');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
