import test from 'node:test'
import assert from 'node:assert/strict'
import {ownedPets} from '../src/services/petOwnership.ts'
const pets=[{id:'a',ownerId:'admin'},{id:'b',ownerId:'other'},{id:'legacy'}]
test('only pets created by current account are returned',()=>{assert.deepEqual(ownedPets(pets,'admin').map(p=>p.id),['a']);assert.deepEqual(ownedPets(pets,'other').map(p=>p.id),['b'])})
test('empty, signed-out and new accounts never receive example or unowned pets',()=>{assert.deepEqual(ownedPets([], 'admin'),[]);assert.deepEqual(ownedPets(pets,null),[]);assert.deepEqual(ownedPets(pets,'new'),[]);assert.deepEqual(ownedPets(pets,''),[])})
