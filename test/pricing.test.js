import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateQuote} from '../public/pricing.js';
const input={task:'maintenance',organization:'ip',regime:'simplified',activity:'services',trade:'none',employees:0,documents:60,issuedInvoices:60,receivedInvoices:60,payments:50,months:1,discount:false,nonresident:false,vat:false,vatRefund:false,assembly:false};
test('corporate photograph tariffs depend on regime and activity, not IP/TOO',()=>{
 for(const organization of ['ip','too'])for(const [regime,activity,base,total] of [['simplified','services',50000,55000],['simplified','goods',100000,110000],['simplified','mixed',100000,110000],['general','services',150000,165000],['general','goods',250000,275000],['general','mixed',250000,275000]]){
  const q=calculateQuote({...input,organization,regime,activity});assert.equal(q.subtotal,base);assert.equal(q.total,total);assert.equal(q.unit,'в месяц');
 }
});
test('seller discount applies to marked-up total',()=>{const q=calculateQuote({...input,discount:true});assert.equal(q.beforeDiscount,55000);assert.equal(q.discount,5500);assert.equal(q.total,49500)});
test('employee groups start at first employee and round partial groups up',()=>{
 for(const [employees,subtotal] of [[0,50000],[1,60000],[5,60000],[6,70000],[10,70000],[11,80000]])assert.equal(calculateQuote({...input,employees}).subtotal,subtotal);
});
test('invoice thresholds are quarterly, payments monthly; each surcharge once',()=>{
 assert.equal(calculateQuote({...input,issuedInvoices:60,receivedInvoices:60,payments:50}).subtotal,50000);
 assert.equal(calculateQuote({...input,issuedInvoices:61}).subtotal,70000);
 assert.equal(calculateQuote({...input,receivedInvoices:61}).subtotal,70000);
 assert.equal(calculateQuote({...input,payments:51}).subtotal,70000);
 assert.equal(calculateQuote({...input,issuedInvoices:1000,receivedInvoices:500,payments:400}).subtotal,110000);
 assert.equal(calculateQuote({...input,documents:100000}).subtotal,50000);
});
test('each corporate supplement is applied and combined import/export is charged once',()=>{
 for(const patch of [{nonresident:true},{vat:true},{vatRefund:true},{trade:'import'},{trade:'export'},{trade:'both'}])assert.equal(calculateQuote({...input,...patch}).subtotal,100000);
 assert.equal(calculateQuote({...input,assembly:true}).subtotal,300000);
 const all=calculateQuote({...input,regime:'general',activity:'mixed',employees:6,issuedInvoices:61,receivedInvoices:61,payments:51,nonresident:true,vat:true,vatRefund:true,trade:'both',assembly:true,discount:true});
 assert.equal(all.subtotal,780000);assert.equal(all.markup,78000);assert.equal(all.discount,85800);assert.equal(all.total,772200);
});
test('restoration stays a project minimum and excludes recurring supplements',()=>{
 const q=calculateQuote({...input,task:'restoration',months:12,employees:50,vat:true,assembly:true,trade:'both',discount:true});assert.equal(q.subtotal,150000);assert.equal(q.total,148500);assert.equal(q.unit,'за проект');assert.match(q.pending.join(' '),/12 мес/);assert.equal(q.items.length,1);
});
test('malformed and out-of-range numeric fields cannot produce a quote',()=>{
 for(const patch of [{employees:-1},{employees:1.5},{documents:NaN},{issuedInvoices:Infinity},{receivedInvoices:-1},{payments:100001},{months:0},{months:121},{organization:'other'},{trade:'invalid'},{discount:'true'},{vat:'yes'}])assert.throws(()=>calculateQuote({...input,...patch}));
});
