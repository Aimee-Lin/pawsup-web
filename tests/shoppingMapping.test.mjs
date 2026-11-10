import test from 'node:test'
import assert from 'node:assert/strict'
import {shoppingFromRows,shoppingQuantity} from '../src/services/shoppingMapping.ts'
test('shopping data replaces current account state and rejects invalid quantities',()=>{
 assert.deepEqual(shoppingFromRows([],[]),{savedProducts:[],cart:{}})
 assert.deepEqual(shoppingFromRows([{product_id:'toy'},{product_id:'toy'}],[{product_id:'toy',quantity:2},{product_id:'bad',quantity:0},{product_id:'huge',quantity:100},{product_id:'fraction',quantity:1.5}]),{savedProducts:['toy'],cart:{toy:2}})
})
test('cart quantity is a finite integer within the supported range',()=>{
 assert.equal(shoppingQuantity(0),1);assert.equal(shoppingQuantity(200),99);assert.equal(shoppingQuantity(2.9),2)
 assert.throws(()=>shoppingQuantity(NaN));assert.throws(()=>shoppingQuantity(Infinity))
})
