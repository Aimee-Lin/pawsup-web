import { createClient } from 'npm:@supabase/supabase-js@2'
import { bearerToken, corsHeaders } from './http.ts'

export function authenticated(handler: (body: Record<string, unknown>) => Promise<unknown>) {
  return async (request: Request) => {
    const headers = corsHeaders(request, (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(origin => origin.trim()))
    if (!headers) return Response.json({ error: '来源不受支持' }, { status: 403 })
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return Response.json({ error: '请求方式不受支持' }, { status: 405, headers })
    const token = bearerToken(request)
    const reply = (data: unknown, status = 200) => Response.json(data, { status, headers })
    if (!token) return reply({ error: '请先登录' }, 401)
    try {
      const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data, error } = await client.auth.getUser(token)
      if (error || !data.user) return reply({ error: '请重新登录' }, 401)
      const raw = await request.text()
      if (raw.length > 12000) return reply({ error: '输入内容太长' }, 413)
      let body
      try { body = JSON.parse(raw) } catch { return reply({ error: '输入格式不正确' }, 400) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: '输入格式不正确' }, 400)
      return reply(await handler(body))
    } catch {
      return reply({ error: '服务暂时不可用，请稍后再试' }, 502)
    }
  }
}
