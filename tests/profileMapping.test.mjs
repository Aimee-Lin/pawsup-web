import test from 'node:test'
import assert from 'node:assert/strict'
import {profileFields} from '../src/services/profileMapping.ts'
test('public profile payload trims text and excludes account identity and email',()=>{
 assert.deepEqual(profileFields(' 西西 ',' 毛毛的日常 ','owner/avatar.jpg'),{display_name:'西西',bio:'毛毛的日常',avatar_path:'owner/avatar.jpg'})
 assert.deepEqual(profileFields('新朋友','',null),{display_name:'新朋友',bio:'',avatar_path:null})
})
test('profile length validation follows database character count including emoji',()=>{
 assert.throws(()=>profileFields('  ','',null));assert.throws(()=>profileFields('名'.repeat(25),'',null));assert.throws(()=>profileFields('名字','字'.repeat(101),null))
 assert.equal(profileFields('🐾'.repeat(24),'字'.repeat(100),null).display_name,'🐾'.repeat(24))
})
