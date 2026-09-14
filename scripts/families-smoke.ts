import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {families} from '../src/server/families';
import {bookMetadata} from '../src/server/management';
import {db} from '../src/server/db';
const users=[randomUUID(),randomUUID(),randomUUID()],books=[randomUUID(),randomUUID(),randomUUID()];
const [a,b,c]=users;const ids:string[]=[];
const call=(uid:string,method:string,suffix='',body:unknown={})=>families(uid,method,['families',...suffix.split('/').filter(Boolean)],body) as Promise<any>;
const denied=(fn:()=>Promise<unknown>,status:number)=>assert.rejects(fn,(e:any)=>e.status===status);
try{
 for(const [i,id]of users.entries())await db.query('INSERT INTO users(id,username,name,password,admin) VALUES($1,$2,$2,$3,$4)',[id,'family_test_'+id,'not-a-login-hash',i===2]);
 for(const [i,id]of books.entries()){await db.query('INSERT INTO books(id,name,kind,owner_id) VALUES($1,$2,$3,$4)',[id,'测试账本'+i,i===2?'private':'shared',i===1?b:a]);await db.query("INSERT INTO members VALUES($1,$2,'owner')",[id,i===1?b:a]);}
 const f=(await call(a,'POST','',{name:'测试家庭'})).id;ids.push(f);
 assert.equal((await call(b,'GET')).items.length,0);
 await call(a,'POST',f+'/invitations',{username:'family_test_'+b});
 assert.equal((await call(b,'GET')).invitations.length,1);
 await denied(()=>call(b,'GET',f),403);
 await call(b,'POST',f+'/invitation',{accept:true});
 await call(a,'POST',f+'/books',{bookId:books[0]});
 await call(b,'POST',f+'/books',{bookId:books[1]});
 assert.equal((await call(a,'GET',f)).books.length,1);
 assert.equal((await call(b,'GET',f)).books.length,1);
 await denied(()=>call(c,'GET',f),403); // System admin does not acquire family access.
 await denied(()=>call(a,'POST',f+'/books',{bookId:books[2]}),400);
 await denied(()=>call(a,'PUT',f+'/access',{bookId:books[1],userId:a,role:'editor'}),403);
 await call(a,'PUT',f+'/access',{bookId:books[0],userId:b,role:'viewer'});
 assert.equal((await call(b,'GET',f)).books.length,2);
 await call(a,'PUT',f+'/access',{bookId:books[0],userId:b,role:'none'});
 assert.equal((await call(b,'GET',f)).books.length,1);
 await denied(()=>bookMetadata(books[0],{name:'测试',description:'',icon:'📒',kind:'private'}),400);
 await denied(()=>call(a,'DELETE',f+'/members',{userId:a}),400);
 const g=(await call(a,'POST','',{name:'另一个家庭'})).id;ids.push(g);
 await denied(()=>call(a,'POST',g+'/books',{bookId:books[0]}),400);
 await call(a,'PUT',f+'/access',{bookId:books[0],userId:b,role:'editor'});
 await call(a,'PUT',f+'/owner',{userId:b});
 await denied(()=>call(a,'PUT',f,{name:'不应成功',description:''}),403);
 await call(a,'DELETE',f+'/members',{userId:a});
 assert.equal((await db.query('SELECT family_id FROM books WHERE id=$1',[books[0]])).rows[0].family_id,null);
 assert.equal((await db.query('SELECT role FROM members WHERE book_id=$1 AND user_id=$2',[books[0],b])).rows[0].role,'editor');
 await call(b,'DELETE',f);
 assert.equal((await db.query('SELECT family_id FROM books WHERE id=$1',[books[1]])).rows[0].family_id,null);
 assert.equal((await db.query('SELECT id FROM users WHERE id=ANY($1::uuid[])',[users])).rowCount,3);
 await call(a,'POST',g+'/invitations',{username:'family_test_'+c});
 await call(c,'POST',g+'/invitation',{accept:false});
 assert.equal((await call(c,'GET')).items.length,0);
 await call(a,'POST',g+'/invitations',{username:'family_test_'+c});
 await call(a,'DELETE',g+'/invitations',{userId:c});
 await denied(()=>call(c,'POST',g+'/invitation',{accept:true}),404);
 console.log('PASS: independent users, invitation consent/revoke/decline, multiple books, private book protection, per-book grants/revoke, owner transfer, leave/dissolve preserve accounts/books, admin isolation');
}finally{
 await db.query('DELETE FROM families WHERE id=ANY($1::uuid[])',[ids]);await db.query('DELETE FROM books WHERE id=ANY($1::uuid[])',[books]);await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[users]);await db.end();
}
