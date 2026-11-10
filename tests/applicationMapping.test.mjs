import test from 'node:test'
import assert from 'node:assert/strict'
import {applicationFromRow} from '../src/services/applicationMapping.ts'
const row={id:'intent',applicant_id:'alice',post_id:'post',direction:'buyer',status:'pending',created_at:'2026-11-10T00:00:00Z',posts:{title:'代遛服务',owner_id:'bob'}}
test('intent mapping separates sent and received records by user UUID',()=>{
 const names=new Map([['alice','同名'],['bob','同名']])
 const sent=applicationFromRow(row,'alice',names),received=applicationFromRow(row,'bob',names)
 assert.equal(sent.received,false);assert.equal(received.received,true);assert.equal(received.applicantName,'同名');assert.equal(received.applicantId,'alice');assert.equal(received.title,'代遛服务');assert.equal(sent.remote,true)
})
test('hidden posts retain a safe history label and cancellation status',()=>{
 const item=applicationFromRow({...row,status:'cancelled',posts:null},'alice',new Map())
 assert.equal(item.title,'帖子已下架或不可见');assert.equal(item.status,'cancelled');assert.equal(item.applicantName,'铲屎官')
})
