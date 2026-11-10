import test from 'node:test'
import assert from 'node:assert/strict'
import {postFromRow} from '../src/services/postMapping.ts'
const row={id:'post',owner_id:'alice',title:'Hello',content:'Pet story',kind:'chat',category:'养宠交流',service_role:undefined,service_kind:'',price:null,location:'',when_text:'',image_paths:['alice/photo.jpg'],created_at:'2026-11-10T00:00:00Z',updated_at:'2026-11-10T01:00:00Z',post_pets:[{pet_id:'pet'}],likes:[{owner_id:'bob'}],comments:[{id:'later',owner_id:'bob',content:'Second',created_at:'2026-11-10T02:00:00Z'},{id:'first',owner_id:'alice',content:'First',created_at:'2026-11-10T01:00:00Z'}]}
test('cloud posts derive ownership and likes from UUIDs, never matching nicknames',()=>{
 const names=new Map([['alice','同名'],['bob','同名']])
 const p=postFromRow(row,'bob',names,['signed-url'],'avatar')
 assert.equal(p.mine,false);assert.equal(p.liked,true);assert.equal(p.likes,1);assert.equal(p.ownerId,'alice');assert.deepEqual(p.imagePaths,['alice/photo.jpg']);assert.equal(p.image,'signed-url');assert.equal(p.price,'');assert.deepEqual(p.comments.map(c=>c.id),['first','later']);assert.equal(row.comments[0].id,'later')
 assert.equal(postFromRow(row,'alice',names,[],'avatar').mine,true)
})
test('missing public profile and private pet joins do not invent other users pets',()=>{
 const p=postFromRow({...row,post_pets:[],price:0},'other',new Map(),[],'avatar')
 assert.equal(p.author,'铲屎官');assert.equal(p.image,'');assert.equal(p.price,'0');assert.deepEqual(p.petIds,[]);assert.equal(p.liked,false)
})
