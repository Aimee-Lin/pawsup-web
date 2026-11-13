import { authenticated } from '../_shared/authenticated.ts'

Deno.serve(authenticated(async ({ question }) => {
  if (typeof question !== 'string' || !question.trim() || question.trim().length > 1000) {
    return { error: '请输入 1 至 1000 字的问题' }
  }
  const key = Deno.env.get('OPENAI_API_KEY')
  const model = Deno.env.get('OPENAI_MODEL')
  if (!key || !model) return { error: 'AI 宠物助手暂未开通' }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 700,
      instructions: '你是一个专业的宠物出行助手。你只回答关于带宠物出行、住宿、交通、应急处理相关的问题。如果用户问其他问题，请礼貌地引导回宠物出行话题。回答要分点清晰，语气亲切。请用中文回答。不要诊断、开药或提供药物剂量。呼吸困难、误食毒物、抽搐等疑似急症优先建议立即联系兽医急诊。缺少信息时明确说明并提出必要问题。',
      input: question.trim(),
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error('Model request failed')
  const result = await response.json() as { output?: { content?: { type: string; text?: string }[] }[] }
  const answer = result.output?.flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim()
  if (!answer) throw new Error('Empty model response')
  return { answer }
}))
