import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateQuote} from '../public/pricing.js';
const input={task:'maintenance',organization:'ip',regime:'simplified',activity:'services',trade:'none',employees:5,documents:60,months:1,discount:false};
test('published monthly tariffs and 10 percent markup',()=>{
 for(const [organization,regime,base,total] of [['ip','simplified',50000,55000],['too','simplified',80000,88000],['ip','general',150000,165000],['too','general',150000,165000]]) {
  const q=calculateQuote({...input,organization,regime});assert.equal(q.subtotal,base);assert.equal(q.total,total);assert.equal(q.discount,0);assert.equal(q.unit,'в месяц');
 }
});
test('seller discount is 10 percent of the marked up total, not the base',()=>{
 const q=calculateQuote({...input,discount:true});assert.equal(q.beforeDiscount,55000);assert.equal(q.discount,5500);assert.equal(q.total,49500);
});
test('employee block boundaries and different included headcounts',()=>{
 for(const [employees,extra] of [[0,0],[5,0],[6,5000],[10,5000],[11,10000]]) assert.equal(calculateQuote({...input,employees}).subtotal,50000+extra);
 assert.equal(calculateQuote({...input,regime:'general',employees:10}).subtotal,150000);
 assert.equal(calculateQuote({...input,regime:'general',employees:11}).subtotal,155000);
});
test('restoration is an explicit minimum and does not invent a monthly tariff',()=>{
 const q=calculateQuote({...input,task:'restoration',months:12,employees:50,discount:true});
 assert.equal(q.subtotal,150000);assert.equal(q.total,148500);assert.equal(q.unit,'за проект');assert.match(q.pending.join(' '),/12 мес/);assert.equal(q.estimate,true);
});
test('unapproved document, goods and foreign trade surcharges are never invented',()=>{
 const q=calculateQuote({...input,documents:10000,activity:'mixed',trade:'both'});
 assert.equal(q.total,55000);assert.equal(q.pending.length,3);assert.match(q.pending.join(' '),/10000/);assert.match(q.pending.join(' '),/Товары/);assert.match(q.pending.join(' '),/экспорт/);
});
test('malformed, negative, fractional, nonfinite and out-of-range inputs fail',()=>{
 for(const patch of [{employees:-1},{employees:1.5},{documents:NaN},{documents:Infinity},{documents:100001},{months:0},{months:121},{organization:'other'},{trade:'invalid'},{discount:'true'}])assert.throws(()=>calculateQuote({...input,...patch}));
});
