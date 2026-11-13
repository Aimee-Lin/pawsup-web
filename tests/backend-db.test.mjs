import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',P='33333333-3333-4333-8333-333333333333',Q='44444444-4444-4444-8444-444444444444',POST='55555555-5555-4555-8555-555555555555'
const db=new PGlite()
// Supabase-owned schemas are stubs; public migrations/policies are executed verbatim.
await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:greatest(array_length(string_to_array($1,'/'),1)-1,0)] $$;
`)
const sqlPaths=process.env.PAWS_BOOTSTRAP_TEST==='1'?['../supabase/bootstrap.sql']:['../supabase/migrations/202611090001_core.sql','../supabase/migrations/202611090002_storage.sql','../supabase/seed.sql']
for(const path of sqlPaths){try{await db.exec(await fs.readFile(new URL(path,import.meta.url),'utf8'))}catch(e){throw new Error(`${path}: ${e.message} (position ${e.position})`)}}
await db.exec(await fs.readFile(new URL('../supabase/migrations/202611100001_local_service_messages.sql',import.meta.url),'utf8'))
await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$3),($2,$4)',[A,B,JSON.stringify({name:'User A'}),JSON.stringify({name:'User B'})])
async function as(id,sql){await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`);return db.exec(sql)}
async function denied(id,sql){await assert.rejects(()=>as(id,sql))}
function count(results){return results[0].rows.length}
test('database ownership and prerequisites',async()=>{
 assert.equal(count(await as(A,'select * from public.pets')),0)
 await denied(A,`insert into public.posts(title,content,kind) values('hello','content','chat')`)
 await as(A,`insert into public.pets(id,name,species) values('${P}','Cloud','cat')`)
 await as(B,`insert into public.pets(id,name,species) values('${Q}','Pudding','dog')`)
 assert.equal(count(await as(B,`select * from public.pets where id='${P}'`)),0)
 assert.equal(count(await as(B,`update public.pets set name='stolen' where id='${P}' returning id`)),0)
 await denied(B,`insert into public.pets(owner_id,name,species) values('${A}','Fake','cat')`)
 await denied(A,`update public.pets set owner_id='${B}' where id='${P}'`)
 await as(A,`insert into public.posts(id,title,content,kind) values('${POST}','hello','content','chat')`)
 await denied(A,`insert into public.post_pets(post_id,pet_id) values('${POST}','${Q}')`)
 await as(A,`insert into public.post_pets(post_id,pet_id) values('${POST}','${P}')`)
 await denied(A,`insert into public.trips(city,departure_at,pet_ids,scene_ids) values('Shanghai',now()+interval '1 day',array['${Q}'::uuid],array['park'])`)
 await as(A,`insert into public.trips(city,departure_at,pet_ids,scene_ids) values('Shanghai',now()+interval '1 day',array['${P}'::uuid],array['park'])`)
 assert.equal(count(await as(B,`select * from public.trips`)),0)
})
test('community policies prevent forged actors and duplicate likes',async()=>{
 assert.equal(count(await as(B,`select * from public.posts where id='${POST}'`)),1)
 await as(B,`insert into public.comments(post_id,content) values('${POST}','nice')`)
 await denied(B,`insert into public.comments(post_id,owner_id,content) values('${POST}','${A}','forged')`)
 await as(B,`insert into public.likes(post_id) values('${POST}')`)
 await denied(B,`insert into public.likes(post_id) values('${POST}')`)
 assert.equal(count(await as(B,`update public.posts set title='changed' where id='${POST}' returning id`)),0)
 await as(A,`update public.posts set status='removed' where id='${POST}'`)
 assert.equal(count(await as(B,`select * from public.posts where id='${POST}'`)),0)
 await denied(B,`insert into public.comments(post_id,content) values('${POST}','hidden')`)
 await as(A,`update public.posts set status='published' where id='${POST}'`)
})
test('service intentions validate direction, actors, duplicates and cancellation',async()=>{
 await as(A,`insert into public.posts(id,title,content,kind,service_role,location,when_text) values('66666666-6666-4666-8666-666666666666','walk','offer service','service','offer','city','weekend')`)
 await denied(A,`insert into public.service_applications(post_id,direction) values('66666666-6666-4666-8666-666666666666','buyer')`)
 await denied(B,`insert into public.service_applications(post_id,direction) values('66666666-6666-4666-8666-666666666666','provider')`)
 await as(B,`insert into public.service_applications(post_id,direction) values('66666666-6666-4666-8666-666666666666','buyer')`)
 await denied(B,`insert into public.service_applications(post_id,direction) values('66666666-6666-4666-8666-666666666666','buyer')`)
 assert.equal(count(await as(A,`update public.service_applications set status='cancelled' returning id`)),0)
 const message = `insert into public.intent_messages(application_id,content) select id,'Hello' from public.service_applications`
 await as(B,message)
 assert.equal(count(await as(A,'select * from public.intent_messages')),1)
 await as(A,message)
 await denied(A,`insert into public.intent_messages(application_id,sender_id,content) select id,'${B}','forged' from public.service_applications`)
 await as(B,`update public.service_applications set status='cancelled'`)
 assert.equal(count(await as(B,`update public.service_applications set status='pending' returning id`)),0)
 await denied(B,message)
 assert.equal(count(await as(B,'select * from public.intent_messages')),2)
})
test('private media is isolated and published post images alone become readable',async()=>{
 await as(A,`insert into storage.objects(bucket_id,name) values('pet-photos','${A}/pet.jpg'),('post-images','${A}/post.jpg')`)
 assert.equal(count(await as(B,`select * from storage.objects`)),0)
 await denied(B,`insert into storage.objects(bucket_id,name) values('avatars','${A}/stolen.jpg')`)
 await denied(A,`update public.posts set image_paths=array['${B}/stolen.jpg'] where id='${POST}'`)
 await as(A,`update public.posts set image_paths=array['${A}/post.jpg'] where id='${POST}'`)
 assert.equal(count(await as(B,`select * from storage.objects`)),1)
 await as(A,`update public.posts set status='removed' where id='${POST}'`)
 assert.equal(count(await as(B,`select * from storage.objects`)),0)
})
test('catalog is read-only, carts and favorites are private, AI writes are server-only',async()=>{
 assert.equal(count(await as(A,`select * from public.products`)),5)
 await denied(A,`update public.products set price=0`)
 await as(A,`insert into public.cart_items(product_id,quantity) values('snack',2)`)
 await as(A,`insert into public.product_favorites(product_id) values('toy')`)
 assert.equal(count(await as(B,`select * from public.cart_items`)),0)
 assert.equal(count(await as(B,`select * from public.product_favorites`)),0)
 await denied(A,`insert into public.cart_items(product_id,quantity) values('toy',100)`)
 await denied(A,`insert into public.ai_conversations(pet_id,owner_id) values('${Q}','${A}')`)
 await denied(A,`insert into public.ai_usage(owner_id,request_id,model,input_tokens,output_tokens) values('${A}',gen_random_uuid(),'fake',0,0)`)
 await denied(A,`insert into public.ai_messages(conversation_id,owner_id,role,content) values(gen_random_uuid(),'${A}','assistant','fake')`)
})
test('anonymous cannot read application data',async()=>{await db.exec('reset role;set role anon');await assert.rejects(()=>db.exec('select * from public.pets'));await assert.rejects(()=>db.exec('select * from public.posts'))})
test.after(async()=>{await db.close()})
