import test from 'node:test'
import assert from 'node:assert/strict'
import {makeStops,validateTrip,todayInShanghai} from '../src/services/trips.ts'
const now=new Date('2026-11-09T02:00:00Z')
test('Shanghai date rolls over at UTC 16:00',()=>{assert.equal(todayInShanghai(new Date('2026-11-09T16:00:00Z')),'2026-11-10')})
test('route preserves selected order, ignores unknown scenes and duplicates',()=>{assert.deepEqual(makeStops(['cafe','unknown','park','cafe']).map(s=>s.title),['宠物咖啡馆','宠物友好公园'])})
test('rejects empty selections, invalid date and past departure',()=>{assert.match(validateTrip([],['park'],'2026-11-10','09:00',now),/宠物/);assert.match(validateTrip(['p'],[],'2026-11-10','09:00',now),/场景/);assert.match(validateTrip(['p'],['park'],'2026-02-30','09:00',now),/日期/);assert.match(validateTrip(['p'],['park'],'2026-11-10','25:00',now),/时间/);assert.match(validateTrip(['p'],['park'],'2026-11-09','09:59',now),/晚于/);assert.equal(validateTrip(['p'],['park'],'2026-11-09','10:01',now),'')})
