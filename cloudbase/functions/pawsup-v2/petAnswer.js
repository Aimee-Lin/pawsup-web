const endpoint = 'https://tokenhub.tencentmaas.com/v1/chat/completions'

async function requestPetAnswer(question, {apiKey, model}, fetcher = fetch, history = []) {
  if (typeof question !== 'string' || !question.trim() || [...question.trim()].length > 1000) {
    return { status: 400, error: '请输入 1 至 1000 字的问题' }
  }

  if (!Array.isArray(history) || history.length > 4 || history.some(turn =>
    typeof turn?.question !== 'string' || !turn.question.trim() || [...turn.question].length > 1000 ||
    typeof turn?.answer !== 'string' || !turn.answer.trim() || [...turn.answer].length > 2000
  )) {
    return { status: 400, error: '对话上下文格式不正确，请开始新对话' }
  }
  const context = history.flatMap(turn => [
    { role: 'user', content: turn.question },
    { role: 'assistant', content: turn.answer },
  ])

  if (!apiKey || !model) return { status: 503, error: '请配置 TokenHub API Key 和模型' }
  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model,
        max_tokens: 700,
        messages: [
          { role: 'system', content: '你是一个专业的宠物出行助手。你只回答关于带宠物出行、住宿、交通、应急处理相关的问题。如果用户问其他问题，请礼貌地引导回宠物出行话题。回答要分点清晰，语气亲切。请用中文回答。不诊断、开药或提供药物剂量。疑似急症时建议立即联系兽医急诊。没有实时数据时不要编造。结合前面的对话回答追问，信息不足时问一个关键问题。' },
          ...context,
          { role: 'user', content: question.trim() },
        ],
      }),
    })
    if (response.status === 401 || response.status === 403) {
      return { status: 502, error: 'AI 服务鉴权失败，请检查本机密钥和模型权限' }
    }
    if (response.status === 402) return { status: 502, error: 'TokenHub 模型未开通或额度不足，请检查控制台' }
    if (response.status === 429) return { status: 429, error: 'TokenHub 请求达到限额，请稍后重试' }
    if (!response.ok) return { status: 502, error: 'AI 服务暂时不可用，请稍后重试' }
    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content
    if (typeof answer !== 'string' || !answer.trim()) {
      return { status: 502, error: '模型未返回回答，请换个问法重试' }
    }
    return { status: 200, answer: answer.trim() }
  } catch {
    return { status: 502, error: '连接 AI 服务失败，请检查网络后重试' }
  }
}

module.exports = { requestPetAnswer }
