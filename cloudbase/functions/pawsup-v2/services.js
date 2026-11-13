const { requestPetAnswer } = require('./petAnswer')
const { routeOrder } = require('./routeOrder')

class TencentMapQuotaError extends Error {}

async function travel({ action, city, addresses }, env, fetch) {
  if (typeof city !== 'string' || !city.trim() || city.length > 32) return { error: '请输入有效城市' }
  const key = env.TMAP_WEBSERVICE_KEY
  if (!key) return { error: '请配置腾讯位置服务 WebService Key' }
  const signal = AbortSignal.timeout(15000)

  async function tmap(path, params) {
    const query = new URLSearchParams({ ...params, key })
    const response = await fetch(`https://apis.map.qq.com${path}?${query}`, { signal, redirect: 'error' })
    if (!response.ok) throw Error('Map request failed')
    const data = await response.json()
    if (data.status === 120) throw new TencentMapQuotaError('腾讯位置服务请求过于频繁，请稍后重试')
    if (data.status === 121) throw new TencentMapQuotaError('腾讯位置服务今日调用额度已用完，请在控制台查看配额')
    if (data.status !== 0) throw Error('Map provider rejected request')
    return data.result
  }

  const geocode = (address, region) => tmap('/ws/geocoder/v1/', { address, ...(region ? { region } : {}) })
  const validLocation = point => Number.isFinite(point?.lat) && Math.abs(point.lat) <= 90
    && Number.isFinite(point?.lng) && Math.abs(point.lng) <= 180
  const coordinates = point => `${point.lat},${point.lng}`

  if (action === 'weather') {
    const area = await geocode(city.trim())
    if (!validLocation(area?.location)) return { error: '未找到该城市，请输入完整城市名' }
    const weatherQuery = area.ad_info?.adcode
      ? { adcode: String(area.ad_info.adcode) }
      : { location: coordinates(area.location) }
    const result = await tmap('/ws/weather/v1/', { ...weatherQuery, type: 'now' })
    const weather = result?.realtime?.[0]
    if (!weather?.infos?.weather || weather.infos.temperature == null || !weather.update_time) {
      return { error: '暂未取得当地实况天气' }
    }
    return { weather: {
      city: weather.city || city.trim(),
      condition: weather.infos.weather,
      temperature: String(weather.infos.temperature),
      updatedAt: weather.update_time,
    } }
  }

  if (action !== 'route' || !Array.isArray(addresses) || addresses.length < 2 || addresses.length > 5 ||
      addresses.some(address => typeof address !== 'string' || !address.trim() || address.length > 100)) {
    return { error: '请输入起点、终点和最多三个途经点' }
  }
  const points = await Promise.all(addresses.map(address => geocode(address.trim(), city.trim())))
  if (points.some(point => !validLocation(point?.location))) {
    return { error: '有地址无法定位，请补充区、街道和门牌号' }
  }

  const locations = points.map(point => coordinates(point.location))
  const result = await tmap('/ws/distance/v1/matrix', {
    mode: 'driving',
    from: locations.slice(0, -1).join(';'),
    to: locations.slice(1).join(';'),
  })
  const costs = locations.map((_, from) => locations.map((_, to) => {
    const duration = result?.rows?.[from]?.elements?.[to - 1]?.duration
    return Number.isFinite(duration) && duration >= 0 ? duration : Infinity
  }))
  const { order, seconds } = routeOrder(costs)
  if (!order.length) return { error: '无法计算完整驾车路线，请调整地址后再试' }

  const names = points.map((point, index) => point.title || addresses[index].trim())
  return { route: { minutes: Math.ceil(seconds / 60), stops: order.map((index, position) => {
    const previous = order[position - 1]
    const query = previous === undefined ? null : new URLSearchParams({
      type: 'drive',
      from: names[previous],
      fromcoord: locations[previous],
      to: names[index],
      tocoord: locations[index],
      referer: env.TMAP_URI_REFERER || 'PawsUp',
    })
    return {
      address: names[index],
      location: { latitude: points[index].location.lat, longitude: points[index].location.lng },
      url: query ? `https://apis.map.qq.com/uri/v1/routeplan?${query}` : null,
    }
  }) } }
}

async function handle(event, env = process.env, fetch = globalThis.fetch) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return { error: '输入格式不正确' }
  if (event.action === 'assistant') {
    const result = await requestPetAnswer(event.question, {
      apiKey: env.TOKENHUB_API_KEY, model: env.TOKENHUB_MODEL,
    }, fetch, event.history)
    return result.answer ? { answer: result.answer } : { error: result.error }
  }
  if (event.action === 'weather' || event.action === 'route') {
    try {
      return await travel(event, env, fetch)
    } catch (error) {
      if (error instanceof TencentMapQuotaError) return { error: error.message }
      throw error
    }
  }
  return { error: '不支持的操作' }
}

module.exports = { handle }
