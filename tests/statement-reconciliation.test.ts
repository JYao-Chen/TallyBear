import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileStatement,type StatementRecord} from '../src/lib/statement-reconciliation';

const row=(id:string,amount:number,payee:string,occurredAt:string,externalId=''):StatementRecord=>({id,kind:'expense',amount,date:'2026-09-20',payee,occurredAt,externalId});

test('相同商家和金额的多笔交易可由前后强锚点按顺序对齐',()=>{
 const statement=[row('s1',1000,'早餐','08:00','flow-a'),row('s2',500,'公交','08:30'),row('s3',500,'公交','09:00'),row('s4',3000,'午餐','12:00','flow-d')];
 const ledger=[row('l1',1000,'早餐','08:00','flow-a'),row('l2',500,'公交',''),row('l3',500,'公交',''),row('l4',3000,'午餐','12:00','flow-d')];
 const result=reconcileStatement(statement,ledger);
 assert.equal(result.summary.matched,4);
 assert.equal(result.matched.filter(m=>m.confidence==='sequence').length,2);
 assert.equal(result.summary.ambiguous,0);
});

test('没有相邻锚点时不把同日同额同商家的重复记录强行认作同一笔',()=>{
 const statement=[row('s1',500,'公交',''),row('s2',500,'公交','')],ledger=[row('l1',500,'公交',''),row('l2',500,'公交','')];
 const result=reconcileStatement(statement,ledger);
 assert.equal(result.summary.matched,0);
 assert.equal(result.summary.ambiguous,2);
});

test('序列中缺少的账单项会单独标记为疑似漏记',()=>{
 const statement=[row('s1',1000,'早餐','08:00','a'),row('s2',2600,'药店','10:00','missing'),row('s3',3000,'午餐','12:00','c')],ledger=[row('l1',1000,'早餐','08:00','a'),row('l3',3000,'午餐','12:00','c')];
 const result=reconcileStatement(statement,ledger);
 assert.deepEqual(result.missing.map(r=>r.id),['s2']);
 assert.equal(result.summary.matched,2);
});

test('相同流水号但金额不一致时提示核对，不会标记为已匹配',()=>{
 const statement=[row('s1',2600,'药店','10:00','same-flow')],ledger=[row('l1',2500,'药店','10:00','same-flow')];
 const result=reconcileStatement(statement,ledger);
 assert.equal(result.summary.matched,0);
 assert.equal(result.summary.ambiguous,1);
 assert.match(result.ambiguous[0].reason,/金额或类型不同/);
});
