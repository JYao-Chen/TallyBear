import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preserveSubscriptionCategory} from '../src/lib/subscription-category';
test('recognized subscription takes precedence over old generic categories only when available',()=>{
 const available=new Set(['会员订阅','Memberships & subscriptions','娱乐']);
 assert.equal(preserveSubscriptionCategory({category:'会员订阅'},available),true);
 assert.equal(preserveSubscriptionCategory({category:'Memberships & subscriptions'},available),true);
 assert.equal(preserveSubscriptionCategory({category:'娱乐'},available),false);
 assert.equal(preserveSubscriptionCategory({category:'会员订阅'},new Set()),false);
});
