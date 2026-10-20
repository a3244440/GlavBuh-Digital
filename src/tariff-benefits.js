import { icon } from './platform.js';
export const includedServices=[
  ['01','Налоговый кабинет','Проверяем кабинет налогоплательщика 2 раза в неделю.'],
  ['02','Отчётность по вашему режиму','Готовим и сдаём налоговую отчётность с учётом применяемого режима налогообложения.'],
  ['03','Контроль обязательств','Проверяем налоговые задолженности, контролируем оплаты, уведомления и состояние лицевого счёта налогоплательщика.'],
  ['04','Консультации','Консультируем по вопросам бухгалтерского и налогового учёта вашей компании.'],
  ['05','База 1С и техподдержка','База 1С входит в тариф. Обеспечиваем техническую поддержку в рамках сопровождения.'],
  ['06','Пороговые лимиты по НДС','Контролируем пороговые лимиты по НДС с учётом вашего налогового режима.']
 ];
const benefitIcons=['shield','doc','eye','chat','db','percent'];
export function tariffBenefits(){
 return `<section class="section tariff-benefits" aria-labelledby="tariff-benefits-title"><div class="wrap"><div class="head reveal"><div><span class="mono">Включено в Standard и Gold · ежемесячное сопровождение</span><h2 id="tariff-benefits-title">Больше, чем <b>ведение учёта.</b></h2></div><p>Проверки, поддержка и команда в составе вашего тарифа.</p></div><div class="g3">${includedServices.map(([n,title,text],i)=>`<article class="tile box reveal">${icon(benefitIcons[i])}<span class="mono">${n}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</div><div class="team box reveal"><div><span class="mono">2-3 сотрудника за вашей компанией</span><h3>Команда под ваш учёт</h3><p>За вашей компанией закрепляются 2-3 сотрудника в зависимости от объёма и особенностей учёта.</p></div><div class="roles"><span><i>ОП</i>Операционист</span><span><i>РО</i>Руководитель отдела</span><span><i>СБ</i>Старший бухгалтер</span></div></div><p class="note">Состав ежемесячного сопровождения Standard и Gold. Разовые услуги, восстановление учёта, Light и Хостинг имеют отдельный состав работ.</p></div></section>`;
}
