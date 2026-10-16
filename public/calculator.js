import { calculateQuote } from './pricing.js';
const form=document.querySelector('#calculator-form');
if(form) {
 const money=value=>new Intl.NumberFormat('ru-KZ',{maximumFractionDigits:0}).format(value);
 const byId=id=>document.getElementById(id);
 let summary='';
 const fieldNames={employees:'Количество сотрудников',issuedInvoices:'Выданные счета-фактуры за месяц',receivedInvoices:'Полученные счета-фактуры за месяц',payments:'Платёжные поручения за месяц',currencyStatements:'Валютные выписки за месяц',tengeStatements:'Тенговые выписки за месяц',months:'Период восстановления'};
 const errorSummary=document.createElement('div');
 errorSummary.className='calc-errors';errorSummary.hidden=true;errorSummary.setAttribute('aria-label','Поля, требующие заполнения');
 byId('calc-live').after(errorSummary);
 for(const [name] of Object.entries(fieldNames)){
  const field=form.elements[name];field.id=`calc-field-${name}`;
  const hint=field.parentElement.querySelector('small');
  if(hint){hint.id=`calc-hint-${name}`;field.setAttribute('aria-describedby',hint.id);}
  const error=document.createElement('span');error.id=`calc-error-${name}`;error.className='calc-field-error';error.hidden=true;
  field.parentElement.append(error);
 }
 let lastErrorSignature=null;
 function validateFields(){
  const errors=[];
  for(const [name,label] of Object.entries(fieldNames)){
   const field=form.elements[name],error=byId(`calc-error-${name}`),hint=byId(`calc-hint-${name}`);
   let message='';
   if(!field.disabled){
    if(field.validity.badInput)message='Введите целое число.';
    else if(field.value.trim()==='')message=name==='months'?'Укажите период восстановления в месяцах.':'Заполните поле. Если нет, укажите 0.';
    else if(!Number.isInteger(field.valueAsNumber))message='Введите целое число без дробной части.';
    else if(field.validity.rangeUnderflow)message=`Минимальное значение: ${field.min}.`;
    else if(field.validity.rangeOverflow)message=`Максимальное значение: ${field.max}.`;
   }
   error.textContent=message;error.hidden=!message;
   field.setAttribute('aria-invalid',String(Boolean(message)));
   field.setAttribute('aria-describedby',[hint?.id,message?error.id:null].filter(Boolean).join(' '));
   if(message)errors.push({field,label,message});
  }
  const signature=JSON.stringify(errors.map(({field,message})=>[field.name,message]));
  if(signature===lastErrorSignature)return errors;
  lastErrorSignature=signature;
  errorSummary.replaceChildren();errorSummary.hidden=errors.length===0;
  if(errors.length){
   const title=document.createElement('p');title.textContent='Чтобы увидеть сумму, заполните или исправьте:';
   const list=document.createElement('ul');
   errors.forEach(({field,label,message})=>{const item=document.createElement('li'),link=document.createElement('a');link.href=`#${field.id}`;link.textContent=label;
    link.addEventListener('click',event=>{event.preventDefault();field.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});field.focus({preventScroll:true});});
    const detail=document.createElement('span');detail.textContent=message;item.append(link,detail);list.append(item);
   });errorSummary.append(title,list);
  }
  return errors;
 }

 function update() {
  const restoring=form.elements.task.value==='restoration';
  form.elements.months.disabled=!restoring;
  form.querySelectorAll('.monthly-options').forEach(section=>{section.hidden=restoring;section.querySelectorAll('input').forEach(field=>field.disabled=restoring)});
  const data=new FormData(form);
  const input={...Object.fromEntries(data),employees:Number(data.get('employees')),currencyStatements:Number(data.get('currencyStatements')),tengeStatements:Number(data.get('tengeStatements')),issuedInvoices:Number(data.get('issuedInvoices')),receivedInvoices:Number(data.get('receivedInvoices')),payments:Number(data.get('payments')),nonresident:data.has('nonresident'),vat:data.has('vat'),vatRefund:data.has('vatRefund'),assembly:data.has('assembly'),months:data.get('task')==='restoration'?Number(data.get('months')):1};
  form.querySelector('.restore-months').hidden=input.task!=='restoration';
  byId('calc-status').textContent='';
  const errors=validateFields();
  const valid=errors.length===0;
  byId('calc-request').disabled=!valid;byId('calc-copy').disabled=!valid;
  if(!valid){byId('calc-total').textContent='...';byId('calc-breakdown').replaceChildren();byId('calc-pending').replaceChildren();byId('calc-status').textContent=`Нужно заполнить или исправить полей: ${errors.length}. Нажмите на название поля в списке выше.`;summary='';return;}

  const quote=calculateQuote(input);
  byId('calc-total').textContent=money(quote.total);
  byId('calc-unit').textContent=quote.unit;
  byId('calc-service').textContent=quote.package;
  const rows=quote.items;
  const breakdown=byId('calc-breakdown');breakdown.replaceChildren();
  rows.forEach(item=>{const row=document.createElement('div');const label=document.createElement('span');label.textContent=item.label;const amount=document.createElement('strong');amount.textContent=`${money(item.amount)} ₸`;row.append(label,amount);breakdown.append(row)});
  byId('calc-pending').replaceChildren(...[...quote.pending,...quote.notes].map(text=>{const item=document.createElement('li');item.textContent=text;return item}));
  const labels={ip:'ИП',too:'ТОО',simplified:'Упрощёнка',general:'ОУР',services:'Услуги',goods:'Товары',mixed:'Услуги и товары',none:'Нет',import:'Импорт',export:'Экспорт',both:'Импорт и экспорт'};
  summary=[`Расчёт ГлавБух · ${input.task==='restoration'?'Восстановление':'Ведение учёта'}`,`${labels[input.organization]} · ${labels[input.regime]} · ${labels[input.activity]}`,`Сотрудников: ${input.employees}; ВЭД: ${labels[input.trade]}`,...(input.task==='restoration'?[`Период восстановления: ${input.months} мес.; выданных СФ/мес.: ${input.issuedInvoices}; полученных СФ/мес.: ${input.receivedInvoices}`]:[]),...(input.task==='maintenance'?[`Выданных СФ/месяц: ${input.issuedInvoices}; полученных СФ/месяц: ${input.receivedInvoices}; платежей/месяц по всем банкам: ${input.payments}`,`Валютные выписки: ${input.currencyStatements}; тенговые выписки: ${input.tengeStatements}`]:[]),...rows.map(item=>`${item.label}: ${money(item.amount)} ₸`),`Ориентир: от ${money(quote.total)} ₸ ${quote.unit}. Не окончательная цена.`,...quote.pending].join('\n');
 }
 form.addEventListener('submit',event=>{event.preventDefault();update();const first=form.querySelector('[aria-invalid="true"]');if(first)first.focus();else byId('calc-request').click();});
 form.addEventListener('input',update);form.addEventListener('change',update);update();
 byId('calc-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(summary);byId('calc-status').textContent='Расчёт скопирован.'}catch{byId('calc-status').textContent='Копирование недоступно. Вы можете выделить результат вручную.'}});
 byId('calc-request').addEventListener('click',()=>{
  const message=document.querySelector('#lead-form textarea[name="message"]');
  if(message){message.value=summary;document.querySelector('#lead-form select[name="service"]').value=form.elements.task.value==='restoration'?'Восстановление учёта':'Бухгалтерское сопровождение';document.getElementById('contact').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});document.querySelector('#lead-form input[name="name"]').focus({preventScroll:true})}
 });
}
