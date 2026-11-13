import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { localPetAssistant } from './scripts/local-pet-assistant.mjs'

export default defineConfig(({ command, mode }) => {
  const env = command === 'serve' ? loadEnv(mode, process.cwd(), ['TOKENHUB_', 'TMAP_']) : {}
  const config = {
    apiKey: env.TOKENHUB_API_KEY?.trim(),
    model: env.TOKENHUB_MODEL?.trim(),
    tmapKey: env.TMAP_WEBSERVICE_KEY?.trim(),
    tmapReferer: env.TMAP_URI_REFERER?.trim(),
  }

  return {
    plugins: [vue(), localPetAssistant(config)],
    define: { __LOCAL_AI_ENABLED__: JSON.stringify(!!(config.apiKey && config.model)) },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/@supabase/')) return 'supabase'
          },
        },
      },
    },
  }
})
