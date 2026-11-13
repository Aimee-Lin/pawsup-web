const cloudbase = require('@cloudbase/node-sdk')
const { handle } = require('./services')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })

exports.main = async (event) => {
  try {
    const { uid } = await app.auth().getUserInfo()
    if (!uid || uid === 'anon') return { error: '请先登录' }
    if (event?.action !== 'assistant' && event?.action !== 'weather') {
      return { error: '此功能暂未开放' }
    }
    return await handle(event)
  } catch {
    return { error: '服务暂时不可用，请稍后重试' }
  }
}
