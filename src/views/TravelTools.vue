<script setup lang="ts">
import { ref } from 'vue'
import { cloudApp } from '../services/cloudbase'
import { supabase } from '../services/supabase'

const city = ref('')
const start = ref('')
const end = ref('')
const stops = ref(['', '', ''])
const busy = ref('')
const error = ref('')
const weather = ref<{ city: string; condition: string; temperature: string; updatedAt: string }>()
const route = ref<{ minutes: number; stops: { address: string; url: string | null }[] }>()

async function query(action: 'weather' | 'route') {
  if (busy.value) return
  error.value = ''
  if (!city.value.trim()) { error.value = '请输入城市'; return }
  if (action === 'route' && (!start.value.trim() || !end.value.trim())) {
    error.value = '请输入起点和终点'
    return
  }
  if (!supabase) { error.value = '出行工具需要登录云端账号'; return }
  busy.value = action
  if (action === 'weather') weather.value = undefined
  else route.value = undefined
  try {
    const addresses = [start.value.trim(), ...stops.value.map(stop => stop.trim()).filter(Boolean), end.value.trim()]
    const { data, error: requestError } = await supabase.functions.invoke('travel', {
      body: { action, city: city.value.trim(), ...(action === 'route' ? { addresses } : {}) },
    })
    if (requestError || data?.error || !data?.[action]) {
      error.value = data?.error || '查询失败，请稍后重试'
      return
    }
    if (action === 'weather') weather.value = data.weather
    else route.value = data.route
  } catch {
    error.value = '查询失败，请稍后重试'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <main>
    <RouterLink class="back" to="/outing">‹ 返回出行</RouterLink>
    <h1>天气与路线</h1>
    <p v-if="cloudApp" class="muted">天气与路线暂未开放。</p>
    <template v-else>
    <div class="card tools">
      <van-field v-model="city" label="城市" maxlength="32" placeholder="例如：上海市" :disabled="!!busy" />
      <van-button block round :loading="busy === 'weather'" :disabled="!!busy" @click="query('weather')">查实况天气</van-button>
      <p v-if="weather" role="status">{{ weather.city }} · {{ weather.condition }} · {{ weather.temperature }}℃<br>高德更新时间 {{ weather.updatedAt }}</p>
    </div>
    <form class="card tools" @submit.prevent="query('route')">
      <h2>驾车路线优化</h2>
      <p class="muted">固定起点和终点，按预估驾车耗时排列最多三个途经点。</p>
      <van-field v-model="start" label="起点" maxlength="100" :disabled="!!busy" />
      <van-field v-for="(_, index) in stops" :key="index" v-model="stops[index]"
        :label="'途经点 ' + (index + 1)" placeholder="选填" maxlength="100" :disabled="!!busy" />
      <van-field v-model="end" label="终点" maxlength="100" :disabled="!!busy" />
      <van-button block round native-type="submit" type="primary" :loading="busy === 'route'" :disabled="!!busy">计算路线</van-button>
    </form>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <section v-if="route" class="card tools">
      <h2>预计驾车 {{ route.minutes }} 分钟</h2>
      <ol>
        <li v-for="(stop, index) in route.stops" :key="index">
          {{ stop.address }}
          <a v-if="stop.url" :href="stop.url" target="_blank" rel="noopener noreferrer">在高德查看这一段 ›</a>
        </li>
      </ol>
    </section>
    </template>
  </main>
</template>

<style scoped>
.tools { margin-top: 16px; overflow-wrap: anywhere; }
.tools ol { padding-inline-start: 20px; }
.tools li { margin-block: 12px; }
.tools a { display: block; color: #1a55d9; }
</style>
