import { calculateQuote } from './pricing.js';
const form=document.querySelector('#calculator-form');
if(form) {
 const money=value=>new Intl.NumberFormat('ru-KZ',{maximumFractionDigits:0}).format(value);
 const byId=id=>document.getElementById(id);
 let summary='';
 function update() {
  const restoring=form.elements.task.value==='restoration';
  form.elements.months.disabled=!restoring;
  form.querySelectorAll('.monthly-options').forEach(section=>{section.hidden=restoring;section.querySelectorAll('input').forEach(field=>field.disabled=restoring)});
  const data=new FormData(form);
  const input={...Object.fromEntries(data),employees:Number(data.get('employees')),currencyStatements:Number(data.get('currencyStatements')),tengeStatements:Number(data.get('tengeStatements')),issuedInvoices:Number(data.get('issuedInvoices')),receivedInvoices:Number(data.get('receivedInvoices')),payments:Number(data.get('payments')),nonresident:data.has('nonresident'),vat:data.has('vat'),vatRefund:data.has('vatRefund'),assembly:data.has('assembly'),months:data.get('task')==='restoration'?Number(data.get('months')):1,discount:data.has('discount')};
  form.querySelector('.restore-months').hidden=input.task!=='restoration';
  byId('calc-status').textContent='';
  const valid=form.checkValidity() && (input.task==='restoration'?['employees','issuedInvoices','receivedInvoices','months']:['employees','issuedInvoices','receivedInvoices','payments','currencyStatements','tengeStatements']).every(name=>form.elements[name].value.trim()!=='');
  byId('calc-request').disabled=!valid;byId('calc-copy').disabled=!valid;
  if(!valid){byId('calc-total').textContent='—';byId('calc-breakdown').replaceChildren();byId('calc-pending').replaceChildren();byId('calc-status').textContent='Введите целые неотрицательные значения в пределах указанных ограничений.';summary='';return;}
  const quote=calculateQuote(input);
  byId('calc-total').textContent=money(quote.total);
  byId('calc-unit').textContent=quote.unit;
  byId('calc-service').textContent=quote.package;
  const rows=[...quote.items,...(input.discount?[{label:'Личная скидка консультанта 10%',amount:-quote.discount}]:[])];
  const breakdown=byId('calc-breakdown');breakdown.replaceChildren();
  rows.forEach(item=>{const row=document.createElement('div');const label=document.createElement('span');label.textContent=item.label;const amount=document.createElement('strong');amount.textContent=`${money(item.amount)} ₸`;row.append(label,amount);breakdown.append(row)});
  byId('calc-pending').replaceChildren(...[...quote.pending,...quote.notes].map(text=>{const item=document.createElement('li');item.textContent=text;return item}));
  const labels={ip:'ИП',too:'ТОО',simplified:'Упрощёнка',general:'ОУР',services:'Услуги',goods:'Товары',mixed:'Услуги и товары',none:'Нет',import:'Импорт',export:'Экспорт',both:'Импорт и экспорт'};
  summary=[`Расчёт ГлавБух · ${input.task==='restoration'?'Восстановление':'Ведение учёта'}`,`${labels[input.organization]} · ${labels[input.regime]} · ${labels[input.activity]}`,`Сотрудников: ${input.employees}; ВЭД: ${labels[input.trade]}`,...(input.task==='restoration'?[`Период восстановления: ${input.months} мес.; выданных СФ/мес.: ${input.issuedInvoices}; полученных СФ/мес.: ${input.receivedInvoices}`]:[]),...(input.task==='maintenance'?[`Выданных СФ/месяц: ${input.issuedInvoices}; полученных СФ/месяц: ${input.receivedInvoices}; платежей/месяц по всем банкам: ${input.payments}`,`Валютные выписки: ${input.currencyStatements}; тенговые выписки: ${input.tengeStatements}`]:[]),...rows.map(item=>`${item.label}: ${money(item.amount)} ₸`),`Ориентир: от ${money(quote.total)} ₸ ${quote.unit}. Не окончательная цена.`,...quote.pending].join('\n');
 }
 form.addEventListener('input',update);form.addEventListener('change',update);update();
 byId('calc-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(summary);byId('calc-status').textContent='Расчёт скопирован.'}catch{byId('calc-status').textContent='Копирование недоступно. Вы можете выделить результат вручную.'}});
 byId('calc-request').addEventListener('click',()=>{
  const message=document.querySelector('#lead-form textarea[name="message"]');
  if(message){message.value=summary;document.querySelector('#lead-form select[name="service"]').value=form.elements.task.value==='restoration'?'Восстановление учёта':'Бухгалтерское сопровождение';document.getElementById('contact').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});document.querySelector('#lead-form input[name="name"]').focus({preventScroll:true})}
 });
}
