import test from 'node:test'
import assert from 'node:assert/strict'
import {handleHealth} from '../supabase/functions/_shared/http.ts'
const deps={origins:['https://paws.example'],verify:async token=>token==='valid'?{id:'user'}:null,databaseReady:async()=>true}
const request=(method='GET',token,origin='https://paws.example')=>new Request('https://api.example/health',{method,headers:{Origin:origin,...token?{Authorization:`Bearer ${token}`}:{}}})
test('health CORS allows known origins only',async()=>{assert.equal((await handleHealth(request('OPTIONS'),deps)).status,204);assert.equal((await handleHealth(request('GET','valid','https://evil.example'),deps)).status,403)})
test('health rejects local/forged/no session',async()=>{assert.equal((await handleHealth(request(),deps)).status,401);assert.equal((await handleHealth(request('GET','admin'),deps)).status,401);assert.equal((await handleHealth(request('POST','valid'),deps)).status,405)})
test('health success and database errors are explicit and do not leak errors',async()=>{const response=await handleHealth(request('GET','valid'),deps);assert.equal(response.status,200);assert.equal((await response.json()).ai,'not_configured');assert.equal((await handleHealth(request('GET','valid'),{...deps,databaseReady:async()=>false})).status,503);const failure=await handleHealth(request('GET','valid'),{...deps,verify:async()=>{throw Error('secret value')}});assert.equal(failure.status,503);assert.ok(!(await failure.text()).includes('secret value'))})
