import test from 'node:test';
import assert from 'node:assert/strict';
import {operationCatalog,resolveOperation,runOperation} from '../src/server/assistant-operations';
import {operationSummary} from '../src/lib/assistant-operation-display';
const user={id:'00000000-0000-4000-8000-000000000001',username:'test',name:'test',admin:false,avatar:'🐻',theme:'bear' as const};
test('能力目录覆盖管理模块，管理员操作不向普通用户开放',()=>{
 const ids=operationCatalog(user).map(o=>o.id);
 for(const id of ['wallet_create','wallet_reconcile','activity_archive','family_access','category_save','schedule_pause','template_save','book_create','memory_manage','job_retry','export'])assert(ids.includes(id));
 assert(!ids.includes('users'));assert.throws(()=>resolveOperation({operation:'users'},user));
 assert(operationCatalog({...user,admin:true}).some(o=>o.id==='users'));
});
test('不接受任意接口、方法或密钥字段，固定操作不可覆盖',()=>{
 assert.throws(()=>resolveOperation({operation:'arbitrary'},user));
 assert.throws(()=>resolveOperation({operation:'profile_update',params:{password:'x'}},user));
 assert.throws(()=>resolveOperation({operation:'ai_update',params:{key:'x'}},{...user,admin:true}));
 assert.throws(()=>resolveOperation({operation:'wallet_archive',params:{operation:'delete'}},user));
 const value=resolveOperation({operation:'wallet_archive',params:{id:user.id,version:1,archived:false}},user);assert.equal(value.body.operation,'archive');
});
test('只读工具不能执行写操作',async()=>{
 await assert.rejects(()=>runOperation({operation:'wallet_create',params:{name:'不能创建'}},user),/确认/);
});
test('路由参数必须是真实格式编号，不能插入额外路径或查询',()=>{
 assert.throws(()=>resolveOperation({operation:'members',params:{bookId:'../users?admin=true'}},user));
 assert.deepEqual(resolveOperation({operation:'members',params:{bookId:user.id}},user).path,['books',user.id,'members']);
 assert.equal(resolveOperation({operation:'template_save',params:{bookId:user.id}},user).op.method,'PUT');
});
test('确认卡将整数分显示为货币金额，嵌套金额也换算',()=>{
 const summary=operationSummary('校正余额',{balance:96437,archived:false,value:{amount:1200}});
 assert.match(summary[1].value,/964\.37/);assert.equal(summary[2].value,'否');assert.match(summary[3].value,/12\.00/);
});
