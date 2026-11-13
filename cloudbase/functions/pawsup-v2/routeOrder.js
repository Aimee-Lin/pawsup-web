// Find the minimum travel time with fixed endpoints and up to three stops.
function routeOrder(costs) {
  const end = costs.length - 1
  let best = { order: [], seconds: Infinity }
  function visit(order, remaining, seconds) {
    const last = order[order.length - 1]
    if (!remaining.length) {
      const total = seconds + costs[last][end]
      if (total < best.seconds) best = { order: [...order, end], seconds: total }
      return
    }
    for (const next of remaining) {
      const total = seconds + costs[last][next]
      if (total < best.seconds) visit([...order, next], remaining.filter(id => id !== next), total)
    }
  }
  visit([0], Array.from({ length: end - 1 }, (_, index) => index + 1), 0)
  return best
}

module.exports = { routeOrder }
