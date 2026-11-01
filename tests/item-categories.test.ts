import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categoryAmounts,itemCategoryError} from '../src/lib/item-categories';
import {lineItemsSchema} from '../src/lib/line-items';
import {entry} from '../src/server/model';
const items=lineItemsSchema.parse([{name:'青菜',amount:3000,category:'蔬菜'},{name:'面粉',amount:2000,category:'米面粮油'},{name:'外套',amount:10000,category:'服饰'},{name:'满减',kind:'discount',amount:-1000}]);
test('同一笔实付按商品分类，整单优惠分配后不丢分或重复',()=>{
 const parts=categoryAmounts(items,14000,'购物');assert.equal(parts.reduce((n,p)=>n+p.amount,0),14000);assert.equal(parts.length,3);assert.ok(parts.every(p=>p.amount>0));assert.equal(itemCategoryError(items,14000,'购物'),'');
 const plain=items.map(({category,...i})=>i);assert.deepEqual(categoryAmounts(plain,14000,'零食'),[{category:'零食',amount:14000}]);
});
test('指定分类优惠只减该类商品，运费随商品分摊而不产生新分类',()=>{
 const lines=lineItemsSchema.parse([{name:'菜',amount:3000,category:'蔬菜'},{name:'衣服',amount:10000,category:'服饰'},{name:'衣服券',kind:'discount',amount:-1000,category:'服饰'},{name:'配送',kind:'fee',amount:500}]);
 assert.deepEqual(categoryAmounts(lines,12500,'快递费'),[{category:'服饰',amount:9375},{category:'蔬菜',amount:3125}]);
});
test('金额未知或未核平不能分项分类，填写核验原因也不能把未知金额猜成零',()=>{
 for(const amount of [null,2900]){const bad=items.map((i,n)=>n?i:{...i,amount});assert.ok(itemCategoryError(bad,14000,'购物'));const parsed=entry.safeParse({id:crypto.randomUUID(),accountId:crypto.randomUUID(),kind:'expense',amount:14000,date:'2026-10-31',category:'购物',lineItems:bad,verificationReason:'已确认'});assert.equal(parsed.success,false);}
});
test('大额及按期间缩小金额仍精确到分',()=>{
 const lines=lineItemsSchema.parse([{name:'甲',amount:99999999999,category:'甲'},{name:'乙',amount:99999999998,category:'乙'}]);for(const amount of [1,2,99999999999])assert.equal(categoryAmounts(lines,amount,'购物').reduce((n,p)=>n+p.amount,0),amount);
});
test('AI 新增和修改工具都公开商品分类字段',async()=>{
 const {financeTools}=await import('../src/server/finance-agent');
 const create=financeTools.find(t=>t.function.name==='prepare_action') as any;
 const update=financeTools.find(t=>t.function.name==='prepare_transaction_change') as any;
 assert.equal(create.function.parameters.properties.data.properties.lineItems.items.properties.category.type,'string');
 assert.equal(update.function.parameters.properties.changes.properties.lineItems.items.properties.category.type,'string');
});

test('旧优惠和运费的独立分类不产生分类份额，跟随商品且精确到分',()=>{
 const lines=lineItemsSchema.parse([{name:'菜',amount:3000,category:'蔬菜'},{name:'衣服',amount:9000,category:'服饰'},{name:'优惠',kind:'discount',amount:-1000,category:'优惠折扣'},{name:'运费',kind:'fee',amount:501,category:'快递费'}]);
 const parts=categoryAmounts(lines,11501,'购物');assert.deepEqual(parts,[{category:'服饰',amount:8625},{category:'蔬菜',amount:2876}]);assert.equal(itemCategoryError(lines,11501,'购物'),'');
 assert.deepEqual(categoryAmounts(lines,1,'购物').map(p=>p.category),['服饰','蔬菜']);
});
test('只有结算调整有分类时，仍按整单归类；指定商品类的运费可跟随该类',()=>{
 assert.deepEqual(categoryAmounts(lineItemsSchema.parse([{name:'商品',amount:1000},{name:'运费',kind:'fee',amount:100,category:'快递费'}]),1100,'购物'),[{category:'购物',amount:1100}]);
 const lines=lineItemsSchema.parse([{name:'菜',amount:1000,category:'蔬菜'},{name:'衣服',amount:1000,category:'服饰'},{name:'衣服运费',kind:'fee',amount:200,category:'服饰'}]);assert.deepEqual(categoryAmounts(lines,2200,'购物'),[{category:'服饰',amount:1200},{category:'蔬菜',amount:1000}]);
});
