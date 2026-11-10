import test from 'node:test'
import assert from 'node:assert/strict'
import {tripFromRow,tripFields} from '../src/services/tripMapping.ts'
const row={id:'trip',owner_id:'alice',city:'上海',departure_at:'2026-11-10T16:05:00Z',pet_ids:['cat','missing'],scene_ids:['cafe','park'],stops:[{title:'咖啡',note:'确认携宠规则'}],checklist:['牵引绳'],created_at:'2026-11-09T00:00:00Z',updated_at:'2026-11-09T01:00:00Z'}
test('cloud trip converts UTC across midnight to Shanghai date and time',()=>{
 const trip=tripFromRow(row,[{id:'cat',ownerId:'alice',name:'毛毛'}])
 assert.equal(trip.date,'2026-11-11');assert.equal(trip.time,'00:05');assert.deepEqual(trip.petNames,['毛毛','宠物档案已删除']);assert.equal(trip.remote,true);assert.equal(trip.ownerId,'alice')
 const fields=tripFields(trip)
 assert.equal(fields.departure_at,'2026-11-10T16:05:00.000Z');assert.deepEqual(fields.scene_ids,['cafe','park']);assert.deepEqual(fields.checklist,['牵引绳'])
 assert.equal('owner_id' in fields,false);assert.equal('id' in fields,false);assert.equal('petNames' in fields,false)
})
test('trip pet names cannot resolve from another owners cache and mapping does not mutate rows',()=>{
 const trip=tripFromRow(row,[{id:'cat',ownerId:'bob',name:'其他账号宠物'}])
 assert.deepEqual(trip.petNames,['宠物档案已删除','宠物档案已删除'])
 trip.petIds.push('new');trip.stops[0].title='changed';trip.checklist.push('other')
 assert.equal(row.pet_ids.length,2);assert.equal(row.stops[0].title,'咖啡');assert.equal(row.checklist.length,1)
})
