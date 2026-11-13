import petAnswer from '../cloudbase/functions/pawsup-v2/petAnswer.js'

import tools from '../cloudbase/functions/pawsup-v2/services.js'

export function localPetAssistant(config) {
  return {
    name: 'pawsup-local-pet-assistant',
    apply: 'serve',
    configureServer(server) {
      function mount(path, handle) {
        server.middlewares.use(path, async (request, response) => {
          const reply = (status, payload) => {
            response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
            response.end(JSON.stringify(payload))
          }
          const localAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1']
          const host = request.headers.host
          if (!localAddresses.includes(request.socket.remoteAddress) ||
              !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host || '') ||
              request.headers.origin !== `http://${host}`) {
            return reply(403, { error: '仅允许本机预览访问' })
          }
          if (request.method !== 'POST') return reply(405, { error: '请求方式不受支持' })
          if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) {
            return reply(415, { error: '请求格式不正确' })
          }
          try {
            let body = ''
            request.setEncoding('utf8')
            for await (const chunk of request) {
              body += chunk.toString()
              if (Buffer.byteLength(body) > 96 * 1024) return reply(413, { error: '输入内容太长' })
            }
            const payload = JSON.parse(body)
            const { status, ...result } = await handle(payload)
            reply(status, result)
          } catch {
            reply(400, { error: '请求格式不正确' })
          }
        })
      }
      mount('/api/local-pet-assistant', payload =>
        petAnswer.requestPetAnswer(payload?.question, config, undefined, payload?.history))
      mount('/api/local-travel', async payload => {
        if (payload?.action !== 'weather' && payload?.action !== 'route') {
          return { status: 400, error: '不支持的出行操作' }
        }
        try {
          return { status: 200, ...await tools.handle(payload, { TMAP_WEBSERVICE_KEY: config.tmapKey, TMAP_URI_REFERER: config.tmapReferer }) }
        } catch {
          return { status: 502, error: '腾讯位置服务暂时无法查询，请检查城市或稍后重试' }
        }
      })
    },
  }
}
