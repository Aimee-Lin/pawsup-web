import { cloudApp, cloudSession } from './cloudbase'
import { supabase } from './supabase'

export const v2ToolsEnabled = !!(supabase || (cloudApp && import.meta.env.VITE_CLOUDBASE_V2_TOOLS === 'true'))

const localTravel = import.meta.env.DEV && !cloudApp && !supabase
export const travelEnabled = v2ToolsEnabled || localTravel
export const routeOptimizationEnabled = import.meta.env.DEV && localTravel

const localAssistant = import.meta.env.DEV && __LOCAL_AI_ENABLED__ && !cloudApp
export const assistantDemo = import.meta.env.DEV && !localAssistant && !cloudApp && !supabase
export const assistantEnabled = v2ToolsEnabled || localAssistant || assistantDemo

export const assistantExamples = [
  { question: '第一次带猫坐车，要准备什么？', answer: '提前让猫咪熟悉航空箱，出发时把箱子固定在后排。带上熟悉的垫子、饮水和清洁用品。途中保持通风，停车时也不要把猫咪单独留在车里。' },
  { question: '带狗入住酒店前要确认什么？', answer: '提前问清是否接受狗狗、有无体型限制、额外费用和公共区域规则。预订时注明带宠物入住，并保存酒店的确认信息。' },
  { question: '带宠物出远门，要带哪些应急用品？', answer: '准备牵引绳、饮水、清洁袋和宠物身份信息，带上兽医提供的护理说明。出发前查好沿途和目的地的兽医急诊联系方式。' },
]

export type AssistantTurn = { question: string; answer: string }

export async function askPetAssistant(question: string, conversation: AssistantTurn[] = []) {
  const history = conversation.slice(-4).map(turn => ({
    question: turn.question,
    answer: [...turn.answer].slice(0, 2000).join(''),
  }))
  if (localAssistant) {
    const response = await fetch('/api/local-pet-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history }),
    })
    const result: ToolsResult = await response.json()
    if (!response.ok || !result.answer) throw Error(result.error || '暂时未能获取回答，请重试')
    return result.answer
  }
  if (assistantDemo) {
    await new Promise(resolve => setTimeout(resolve, 550))
    return assistantExamples.find(example => example.question === question)?.answer
      ?? '这是问答流程预览。试试上方的示例问题，接通 AI 服务后就可以询问自己的问题。'
  }
  const result = await queryV2Tools({ action: 'assistant', question, history })
  if (!result.answer) throw Error(result.error || '暂时未能获取回答，请重试')
  return result.answer
}

type ToolsResult = {
  error?: string
  answer?: string
  weather?: { city: string; condition: string; temperature: string; updatedAt: string }
  route?: { minutes: number; stops: { address: string; url: string | null }[] }
}

export async function queryV2Tools(body: { action: 'assistant'; question: string; history?: AssistantTurn[] } |
  { action: 'weather' | 'route'; city: string; addresses?: string[] }): Promise<ToolsResult> {
  if (body.action === 'route' && !routeOptimizationEnabled) throw Error('驾车路线优化暂未开放')
  if (localTravel && body.action !== 'assistant') {
    const response = await fetch('/api/local-travel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await response.json() as ToolsResult
  }
  if (!v2ToolsEnabled) throw Error('服务暂未开通')
  if (cloudApp) {
    if (!await cloudSession()) throw Error('请先登录')
    const { result } = await cloudApp.callFunction({ name: 'pawsup-v2', data: body })
    if (!result || typeof result !== 'object') throw Error('服务暂时不可用')
    return result as ToolsResult
  }
  const { data, error } = await supabase!.functions.invoke(body.action === 'assistant' ? 'pet-assistant' : 'travel', { body: body.action === 'assistant' ? { question: body.question } : body })
  if (error) throw error
  return data as ToolsResult
}
