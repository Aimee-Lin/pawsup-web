import assert from 'node:assert/strict'
import test from 'node:test'
import { routeOrder } from '../supabase/functions/_shared/routeOrder.ts'

test('route optimization keeps endpoints and accounts for directional driving times', () => {
  const unavailable = Infinity
  assert.deepEqual(routeOrder([
    [unavailable, 2, 5, unavailable],
    [unavailable, unavailable, 100, 2],
    [unavailable, 1, unavailable, 100],
    [unavailable, unavailable, unavailable, unavailable],
  ]), { order: [0, 2, 1, 3], seconds: 8 })
})

test('route optimization reports an unreachable destination', () => {
  assert.deepEqual(routeOrder([[Infinity, Infinity], [Infinity, Infinity]]), {
    order: [],
    seconds: Infinity,
  })
})
