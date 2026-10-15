// Corporate price list supplied by the owner, October 2026. All amounts in KZT.
export const pricing = {
 monthly:{simplified:{name:'Standard · СНР',services:50000,goods:100000},general:{name:'Gold · ОУР',services:150000,goods:250000}},
 employeeBlock:10000,employeeBlockSize:5,nonresident:50000,
 issuedLimit:60,receivedLimit:60,paymentLimit:50,excess:20000,
 vat:50000,trade:50000,vatRefund:50000,assembly:250000,
 restorationMinimum:150000,markupPercent:10,discountPercent:10
};
export function calculateQuote(input,rates=pricing){
 if(!input||!['maintenance','restoration'].includes(input.task)||!['ip','too'].includes(input.organization)||!['simplified','general'].includes(input.regime)||!['services','goods','mixed'].includes(input.activity)||!['none','import','export','both'].includes(input.trade))throw Error('Проверьте выбранные параметры.');
 for(const [key,max] of [['employees',10000],['documents',100000],['issuedInvoices',100000],['receivedInvoices',100000],['payments',100000],['months',120]])if(!Number.isInteger(input[key])||input[key]<(key==='months'?1:0)||input[key]>max)throw Error('Проверьте количество сотрудников, документов и месяцев.');
 for(const key of ['discount','nonresident','vat','vatRefund','assembly'])if(typeof input[key]!=='boolean')throw Error('Проверьте дополнительные услуги.');
 const restoration=input.task==='restoration',tariff=rates.monthly[input.regime];
 const items=[],notes=[],pending=[];
 const add=(label,amount)=>items.push({label,amount});
 if(restoration){
  add('Восстановление учёта — минимальная стоимость',rates.restorationMinimum);
  pending.push(`Период: ${input.months} мес.; первичных документов в среднем: ${input.documents}/мес. Прайс содержит только «от 150 000 ₸»: итог после оценки состояния учёта.`);
  notes.push('Месячные доплаты пакетов Standard/Gold не прибавляются к разовому восстановлению.');
 }else{
  const goods=input.activity!=='services';
  add(`${tariff.name} · ${goods?'товары'+(input.activity==='mixed'?' и услуги':''):'услуги'}`,goods?tariff.goods:tariff.services);
  if(input.nonresident)add('Сопровождение нерезидента',rates.nonresident);
  if(input.employees){const blocks=Math.ceil(input.employees/rates.employeeBlockSize);add(`Сотрудники: ${input.employees} чел. · ${blocks} групп(ы) по 5`,blocks*rates.employeeBlock);}
  if(input.issuedInvoices>rates.issuedLimit)add('Выданных счетов-фактур свыше 60 за квартал',rates.excess);
  if(input.receivedInvoices>rates.receivedLimit)add('Полученных счетов-фактур свыше 60 за квартал',rates.excess);
  if(input.payments>rates.paymentLimit)add('Платёжных поручений свыше 50 за месяц',rates.excess);
  if(input.vat)add('НДС · форма 300',rates.vat);
  if(input.trade!=='none')add('Экспорт / импорт 328 / СНТ / 1-ТС',rates.trade);
  if(input.vatRefund)add('Возврат НДС в рамках сопровождения',rates.vatRefund);
  if(input.assembly)add('Комплектация / рекомплектация',rates.assembly);
  notes.push('Расчётная трактовка: 10 000 ₸ за каждые начатые 5 сотрудников, с первой группы; доплаты за превышение лимитов начисляются по одному разу по каждому виду.');
  if(input.activity==='mixed')notes.push('Услуги и товары рассчитаны по тарифу товаров, без сложения двух баз.');
  if(input.trade==='both')notes.push('Импорт и экспорт вместе: одна общая доплата 50 000 ₸.');
  notes.push(`Общий объём первички (${input.documents}/мес.) сохранён для консультации. Самостоятельной ставки за него в прайсе нет; доплаты определяются отдельными полями счетов-фактур и платежей.`);
 }
 const subtotal=items.reduce((s,item)=>s+item.amount,0),markup=Math.round(subtotal*rates.markupPercent/100),beforeDiscount=subtotal+markup,discount=input.discount?Math.round(beforeDiscount*rates.discountPercent/100):0;
 return {items,subtotal,markup,beforeDiscount,discount,total:beforeDiscount-discount,pending,notes,estimate:true,unit:restoration?'за проект':'в месяц',package:restoration?'Восстановление учёта':tariff.name};
}
