import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateQuote,pricing} from '../public/pricing.js';
const input={task:'maintenance',organization:'ip',regime:'simplified',activity:'services',trade:'none',employees:0,currencyStatements:0,currencyConversions:0,tengeStatements:0,issuedInvoices:60,receivedInvoices:60,payments:50,months:1,discount:false,nonresident:false,vat:false,vatRefund:false,assembly:false};
test('corporate photograph tariffs depend on regime and activity, not IP/TOO',()=>{
 for(const organization of ['ip','too'])for(const [regime,activity,base,total] of [['simplified','services',50000,50000],['simplified','goods',150000,150000],['simplified','mixed',150000,150000],['general','services',150000,150000],['general','goods',250000,250000],['general','mixed',250000,250000]]){
  const q=calculateQuote({...input,organization,regime,activity});assert.equal(q.subtotal,base);assert.equal(q.total,total);assert.equal(q.unit,'в месяц');
 }
});
test('no markup; seller discount applies directly to calculated cost',()=>{const q=calculateQuote({...input,discount:true});assert.equal(q.beforeDiscount,50000);assert.equal(q.discount,5000);assert.equal(q.total,45000);assert.equal('markup' in q,false)});
test('first five employees are included, subsequent blocks round up',()=>{
 for(const [employees,subtotal] of [[0,50000],[1,50000],[5,50000],[6,60000],[10,60000],[11,70000]])assert.equal(calculateQuote({...input,employees}).subtotal,subtotal);
});
test('invoice and payment thresholds are monthly; payment blocks repeat, invoice surcharge once',()=>{
 assert.equal(calculateQuote({...input,issuedInvoices:60,receivedInvoices:60,payments:50}).subtotal,50000);
 assert.equal(calculateQuote({...input,issuedInvoices:61}).subtotal,70000);
 assert.equal(calculateQuote({...input,receivedInvoices:61}).subtotal,70000);
 for(const [payments,subtotal] of [[0,50000],[50,50000],[51,70000],[100,70000],[101,90000],[150,90000],[151,110000]])assert.equal(calculateQuote({...input,payments}).subtotal,subtotal);
 assert.equal(calculateQuote({...input,issuedInvoices:1000,receivedInvoices:500,payments:400}).subtotal,230000);

});
test('each corporate supplement is applied and combined import/export is charged once',()=>{
 for(const patch of [{nonresident:true},{vat:true},{vatRefund:true},{trade:'import'},{trade:'export'},{trade:'both'}])assert.equal(calculateQuote({...input,...patch}).subtotal,100000);
 assert.equal(calculateQuote({...input,assembly:true}).subtotal,300000);
 const all=calculateQuote({...input,regime:'general',activity:'mixed',employees:6,issuedInvoices:61,receivedInvoices:61,payments:51,nonresident:true,vat:true,vatRefund:true,trade:'both',assembly:true,discount:true});
 assert.equal(all.subtotal,770000);assert.equal(all.discount,77000);assert.equal(all.total,693000);
});
test('restoration stays a project minimum and excludes recurring supplements',()=>{
 const q=calculateQuote({...input,task:'restoration',months:12,employees:50,vat:true,assembly:true,trade:'both',discount:true});assert.equal(q.subtotal,150000);assert.equal(q.total,135000);assert.equal(q.unit,'за проект');assert.match(q.pending.join(' '),/12 мес/);assert.equal(q.items.length,1);
});
test('malformed and out-of-range numeric fields cannot produce a quote',()=>{
 for(const patch of [{employees:-1},{employees:1.5},{currencyStatements:NaN},{issuedInvoices:Infinity},{receivedInvoices:-1},{payments:100001},{months:0},{months:121},{organization:'other'},{trade:'invalid'},{discount:'true'},{vat:'yes'},{currencyConversions:-1},{tengeStatements:1.5}])assert.throws(()=>calculateQuote({...input,...patch}));
});

test('each tenge and currency statement is priced; only conversion rate is pending',()=>{
 const q=calculateQuote({...input,currencyStatements:3,currencyConversions:2,tengeStatements:4});
 assert.equal(q.subtotal,165000);assert.equal(q.pending.length,1);assert.match(q.pending.join(' '),/не включена/);
 const priced=calculateQuote({...input,currencyStatements:3,currencyConversions:2,tengeStatements:4},{...pricing,currencyConversion:2000});
 assert.equal(priced.total,169000);assert.equal(priced.pending.length,0);
});
test('statement counts include the first statement, without per-operation currency charges',()=>{
 assert.equal(calculateQuote({...input,tengeStatements:1}).total,60000);
 assert.equal(calculateQuote({...input,currencyStatements:1}).total,75000);
 const q=calculateQuote({...input,tengeStatements:2,currencyStatements:3,discount:true});
 assert.equal(q.subtotal,145000);assert.equal(q.discount,14500);assert.equal(q.total,130500);
 assert.equal(q.pending.length,0);
});
