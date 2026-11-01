import assert from 'node:assert/strict';
import {db} from '../src/server/db';
import {categoryAmounts} from '../src/lib/item-categories';
import {lineItemsSchema} from '../src/lib/line-items';
import {categoryPartsSql} from '../src/server/item-category-sql';
assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/tallybear_settlement_test');
try{
 const cases=[
  [{name:'菜',amount:3000,category:'蔬菜'},{name:'衣服',amount:9000,category:'服饰'},{name:'优惠',kind:'discount',amount:-1000,category:'优惠折扣'},{name:'运费',kind:'fee',amount:501,category:'快递费'}],
  [{name:'菜',amount:3000,category:'蔬菜'},{name:'衣服',amount:10000,category:'服饰'},{name:'衣服券',kind:'discount',amount:-1000,category:'服饰'},{name:'运费',kind:'fee',amount:500}],
  [{name:'商品',amount:1000},{name:'运费',kind:'fee',amount:100,category:'快递费'}],
  [{name:'菜',amount:1000,category:'蔬菜'},{name:'衣服',amount:1000,category:'服饰'},{name:'衣服运费',kind:'fee',amount:200,category:'服饰'}]
 ];
 for(const raw of cases){const items=lineItemsSchema.parse(raw),total=items.reduce((n,i)=>n+(i.amount||0),0);for(const amount of [total,1,7,119]){
  const parts=(await db.query(`SELECT ${categoryPartsSql()} AS parts FROM (SELECT $1::jsonb AS line_items,$2::text AS category,$3::bigint AS amount) t`,[JSON.stringify(items),'购物',amount])).rows[0].parts;
  assert.deepEqual(parts,categoryAmounts(items,amount,'购物'));assert.equal(parts.reduce((n:number,p:any)=>n+p.amount,0),amount);
 }}console.log('PASS: SQL and client category shares agree for legacy adjustment categories, targeted discounts/fees, whole-order mode and period remainders.');
}finally{await db.end();}
