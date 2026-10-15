// Only confirmed source prices belong here. null means a consultation is required.
export const pricing = {
  monthly: { simplified: { ip: 50000, too: 80000, employees: 5 }, general: { ip: 150000, too: 150000, employees: 10 } },
  extraEmployeeBlock: 5000, employeeBlockSize: 5,
  restorationMinimum: 150000,
  primaryDocuments: null, importExport: null, goods: null,
  markupPercent: 10, discountPercent: 10
};
export function calculateQuote(input, rates = pricing) {
  if (!input || !['maintenance','restoration'].includes(input.task) || !['ip','too'].includes(input.organization) || !['simplified','general'].includes(input.regime) || !['services','goods','mixed'].includes(input.activity) || !['none','import','export','both'].includes(input.trade)) throw new Error('Проверьте выбранные параметры.');
  for (const [key,max] of [['employees',10000],['documents',100000],['months',120]]) {
    if (!Number.isInteger(input[key]) || input[key] < (key === 'months' ? 1 : 0) || input[key] > max) throw new Error('Проверьте количество сотрудников, документов и месяцев.');
  }
  if (typeof input.discount !== 'boolean') throw new Error('Проверьте скидку.');
  const tariff=rates.monthly[input.regime];
  const restoration=input.task==='restoration';
  const base=restoration?rates.restorationMinimum:tariff[input.organization];
  const items=[{label:restoration?'Минимум восстановления учёта':'Базовое обслуживание',amount:base}];
  const pending=[];
  if (restoration) pending.push(`Восстановление за ${input.months} мес.: объём и состояние учёта оцениваются отдельно. Минимум не умножается на месяцы без согласованного тарифа.`);
  else {
    const extra=Math.max(0,input.employees-tariff.employees);
    if(extra)items.push({label:`Сотрудники сверх ${tariff.employees}: ${extra} чел. (${Math.ceil(extra/rates.employeeBlockSize)} × ${rates.extraEmployeeBlock.toLocaleString('ru-RU')} ₸)`,amount:Math.ceil(extra/rates.employeeBlockSize)*rates.extraEmployeeBlock});
  }
  // Published invoices/quarter and payments/month are not a tariff for all primary documents.
  pending.push(`Первичные документы: ${input.documents} в месяц. Ставка и включённый объём требуют уточнения.`);
  if(input.trade!=='none')pending.push('Импорт / экспорт: доплата зависит от операций и необходимых форм отчётности.');
  if(input.activity!=='services')pending.push('Товары и складской учёт: доплата требует уточнения.');
  const subtotal=items.reduce((sum,item)=>sum+item.amount,0);
  const markup=Math.round(subtotal*rates.markupPercent/100);
  const beforeDiscount=subtotal+markup;
  const discount=input.discount?Math.round(beforeDiscount*rates.discountPercent/100):0;
  return {items,subtotal,markup,beforeDiscount,discount,total:beforeDiscount-discount,pending,estimate:true,unit:restoration?'за проект':'в месяц'};
}
