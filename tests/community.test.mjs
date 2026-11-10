import test from 'node:test'
import assert from 'node:assert/strict'
// Compile this dependency-free logic through the project's TypeScript compiler API.
import ts from 'typescript'
import fs from 'node:fs'
const text=fs.readFileSync(new URL('../src/services/community.ts',import.meta.url),'utf8')
const logic=text.slice(text.indexOf('export function kindOf'),text.indexOf('const seeds='))
const compiled=ts.transpile(logic,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})
const {kindOf,matchesPost,validatePost}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
test('legacy categories map to compatible community kinds',()=>{assert.equal(kindOf({category:'找搭子'}),'buddy');assert.equal(kindOf({category:'出行日记'}),'chat');assert.equal(kindOf({kind:'service'}),'service')})
test('filters combine type and trimmed case-insensitive search',()=>{const post={kind:'service',title:'Feed CAT',content:'上门喂猫',author:'邻居',location:'上海'};assert.equal(matchesPost(post,'service',' cat '),true);assert.equal(matchesPost(post,'buddy','cat'),false);assert.equal(matchesPost(post,'all','上海'),true);assert.equal(matchesPost(post,'all','北京'),false)})
test('text-only chat is allowed; service needs location/time and valid price',()=>{const base={title:'测试',content:'内容',kind:'chat',location:'',when:'',price:''};assert.equal(validatePost(base),'');assert.match(validatePost({...base,title:'  '}),/标题/);assert.match(validatePost({...base,kind:'service'}),/地区/);assert.match(validatePost({...base,kind:'service',location:'上海'}),/时间/);assert.match(validatePost({...base,kind:'service',location:'上海',when:'周末',price:'-1'}),/金额/);assert.match(validatePost({...base,price:'1.234'}),/金额/);assert.equal(validatePost({...base,kind:'service',location:'上海',when:'周末',price:'35.50'}),'')})
