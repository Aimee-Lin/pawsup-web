import { authenticated } from '../_shared/authenticated.ts'
import { routeOrder } from '../_shared/routeOrder.ts'

type Place = { formatted_address: string; location: string; adcode: string }

Deno.serve(authenticated(async ({ action, city, addresses }) => {
  if (typeof city !== 'string' || !city.trim() || city.length > 32) return { error: '请输入有效城市' }
  const key = Deno.env.get('AMAP_WEB_SERVICE_KEY')
  if (!key) return { error: '高德出行服务暂未开通' }
  async function amap<T>(path: string, params: Record<string, string>): Promise<T> {
    const query = new URLSearchParams({ ...params, key: key! })
    const response = await fetch(`https://restapi.amap.com/${path}?${query}`, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('Map request failed')
    const result = await response.json()
    if (result.status !== '1') throw new Error('Map provider rejected request')
    return result as T
  }
  const geocode = (address: string, cityHint?: string) =>
    amap<{ geocodes: Place[] }>('v3/geocode/geo', { address, ...(cityHint ? { city: cityHint } : {}) })
  if (action === 'weather') {
    const area = (await geocode(city.trim())).geocodes?.[0]
    if (!area?.adcode) return { error: '未找到该城市，请输入完整城市名' }
    const result = await amap<{ lives: { city: string; weather: string; temperature: string; reporttime: string }[] }>(
      'v3/weather/weatherInfo', { city: area.adcode, extensions: 'base' })
    const weather = result.lives?.[0]
    if (!weather) return { error: '暂未取得当地实况天气' }
    return { weather: { city: weather.city, condition: weather.weather, temperature: weather.temperature, updatedAt: weather.reporttime } }
  }
  if (action !== 'route' || !Array.isArray(addresses) || addresses.length < 2 || addresses.length > 5 ||
      addresses.some(address => typeof address !== 'string' || !address.trim() || address.length > 100)) {
    return { error: '请输入起点、终点和最多三个途经点' }
  }
  const points = await Promise.all(addresses.map(async address => (await geocode(address.trim(), city.trim())).geocodes?.[0]))
  if (points.some(point => !point?.location)) return { error: '有地址无法定位，请补充区、街道和门牌号' }
  const costs = Array.from({ length: points.length }, () => Array<number>(points.length).fill(Infinity))
  await Promise.all(points.slice(1).map(async (destination, offset) => {
    const destinationIndex = offset + 1
    const origins = points.map((point, index) => ({ point, index }))
      .filter(({ index }) => index !== destinationIndex && index < points.length - 1)
    const { results } = await amap<{ results: { origin_id: string; duration: string }[] }>('v3/distance', {
      origins: origins.map(({ point }) => point.location).join('|'), destination: destination.location, type: '1',
    })
    for (const result of results || []) {
      const origin = origins[Number(result.origin_id) - 1]
      const duration = Number(result.duration)
      if (origin && result.duration !== '' && Number.isFinite(duration) && duration >= 0) costs[origin.index][destinationIndex] = duration
    }
  }))
  const { order, seconds } = routeOrder(costs)
  if (!order.length) return { error: '无法计算完整驾车路线，请调整地址后再试' }
  return { route: { minutes: Math.ceil(seconds / 60), stops: order.map((index, position) => {
    const point = points[index]
    const previous = points[order[position - 1]]
    const query = previous && new URLSearchParams({
      from: previous.location, to: point.location, mode: 'car', src: 'PawsUp', callnative: '0',
    })
    return { address: point.formatted_address, url: query ? `https://uri.amap.com/navigation?${query}` : null }
  }) } }
}))
