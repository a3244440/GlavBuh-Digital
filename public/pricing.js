// Corporate price list supplied by the owner, October 2026. All amounts in KZT.
export const pricing = {
 monthly:{simplified:{name:'Standard · СНР',services:50000},general:{name:'Gold · ОУР',services:150000}},
 goodsSupplement:100000,includedEmployees:5,employeeBlock:10000,employeeBlockSize:5,nonresident:50000,
 issuedLimit:60,receivedLimit:60,paymentLimit:50,excess:20000,
 vat:50000,trade:50000,vatRefund:50000,assembly:250000,
 restorationMinimum:150000,discountPercent:10,
 currencyStatement:25000,currencyConversion:null,tengeStatement:10000
};
export function calculateQuote(input,rates=pricing){
 if(!input||!['maintenance','restoration'].includes(input.task)||!['ip','too'].includes(input.organization)||!['simplified','general'].includes(input.regime)||!['services','goods','mixed'].includes(input.activity)||!['none','import','export','both'].includes(input.trade))throw Error('Проверьте выбранные параметры.');
 for(const [key,max] of [['employees',10000],['issuedInvoices',100000],['receivedInvoices',100000],['payments',100000],['currencyStatements',100000],['currencyConversions',100000],['tengeStatements',10000],['months',120]])if(!Number.isInteger(input[key])||input[key]<(key==='months'?1:0)||input[key]>max)throw Error('Проверьте количество сотрудников, документов и месяцев.');
 for(const key of ['discount','nonresident','vat','vatRefund','assembly'])if(typeof input[key]!=='boolean')throw Error('Проверьте дополнительные услуги.');
 const restoration=input.task==='restoration',tariff=rates.monthly[input.regime];
 const items=[],notes=[],pending=[];
 const add=(label,amount)=>items.push({label,amount});
 if(restoration){
  add('Восстановление учёта — минимальная стоимость',rates.restorationMinimum);
  pending.push(`Период: ${input.months} мес.; выданных СФ: ${input.issuedInvoices}/мес., полученных СФ: ${input.receivedInvoices}/мес. Прайс содержит только «от 150 000 ₸»: итог после оценки состояния учёта.`);
  notes.push('Месячные доплаты пакетов Standard/Gold не прибавляются к разовому восстановлению.');
 }else{
  const goods=input.activity!=='services';
  add(`${tariff.name} · основное ведение учёта`,tariff.services);
  if(goods)add('Учёт товаров'+(input.activity==='mixed'?' и услуг':''),rates.goodsSupplement);
  if(input.nonresident)add('Сопровождение нерезидента',rates.nonresident);
  if(input.employees>rates.includedEmployees){const extra=input.employees-rates.includedEmployees,blocks=Math.ceil(extra/rates.employeeBlockSize);add(`Сотрудники сверх первых 5: ${extra} чел. · ${blocks} групп(ы)`,blocks*rates.employeeBlock);}
  if(input.issuedInvoices>rates.issuedLimit)add('Выданных счетов-фактур свыше 60 за месяц',rates.excess);
  if(input.receivedInvoices>rates.receivedLimit)add('Полученных счетов-фактур свыше 60 за месяц',rates.excess);
  if(input.payments>rates.paymentLimit){const blocks=Math.ceil((input.payments-rates.paymentLimit)/rates.paymentLimit);add(`Платежи сверх 50: ${blocks} блок(а) по 50`,blocks*rates.excess);}
  for(const [key,rateKey,label] of [['currencyStatements','currencyStatement','Валютные выписки'],['currencyConversions','currencyConversion','Конвертация валют'],['tengeStatements','tengeStatement','Тенговые выписки']]){
   if(input[key]>0){
    if(rates[rateKey]===null)pending.push(`${label}: ${input[key]}. Ставка уточняется; доплата в сумму не включена.`);
    else add(`${label}: ${input[key]}`,input[key]*rates[rateKey]);
   }
  }
  if(input.vat)add('НДС · форма 300',rates.vat);
  if(input.trade!=='none')add('Экспорт / импорт 328 / СНТ / 1-ТС',rates.trade);
  if(input.vatRefund)add('Возврат НДС в рамках сопровождения',rates.vatRefund);
  if(input.assembly)add('Комплектация / рекомплектация',rates.assembly);
  notes.push('Первые 5 сотрудников включены. Далее 10 000 ₸ за каждые следующие начатые 5 сотрудников; за каждые следующие начатые 50 платежей +20 000 ₸. Превышение 60 выданных и 60 полученных счетов-фактур — по одной доплате 20 000 ₸ отдельно.');
  if(input.activity==='mixed')notes.push('При наличии товаров к основному ведению добавлено 100 000 ₸; база услуг второй раз не начисляется.');
  if(input.trade==='both')notes.push('Импорт и экспорт вместе: одна общая доплата 50 000 ₸.');

 }
 const subtotal=items.reduce((s,item)=>s+item.amount,0),beforeDiscount=subtotal,discount=input.discount?Math.round(subtotal*rates.discountPercent/100):0;
 return {items,subtotal,beforeDiscount,discount,total:beforeDiscount-discount,pending,notes,estimate:true,unit:restoration?'за проект':'в месяц',package:restoration?'Восстановление учёта':tariff.name};
}
