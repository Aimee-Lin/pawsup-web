<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { queryV2Tools, routeOptimizationEnabled, travelEnabled } from '../services/v2Tools'

const cityQuery = useRoute().query.city
const city = ref(typeof cityQuery === 'string' ? cityQuery.slice(0,32) : '')
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
  busy.value = action
  if (action === 'weather') weather.value = undefined
  else route.value = undefined
  try {
    const addresses = [start.value.trim(), ...stops.value.map(stop => stop.trim()).filter(Boolean), end.value.trim()]
    const data = await queryV2Tools({
      action, city: city.value.trim(), ...(action === 'route' ? { addresses } : {}),
    })
    if (data.error || !data?.[action]) {
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
    <h1>{{ routeOptimizationEnabled ? '天气与路线' : '实况天气' }}</h1>
    <p v-if="!travelEnabled" class="muted">实况天气暂未开放。</p>
    <template v-else>
    <form class="card tools" @submit.prevent="query('weather')">
      <h2>城市实况</h2>
      <van-field v-model="city" label="城市" maxlength="32" placeholder="例如：上海市" :disabled="!!busy" />
      <van-button block round :loading="busy === 'weather'" :disabled="!!busy" native-type="submit">查实况天气</van-button>
      <p v-if="weather" role="status"><strong class="temperature">{{ weather.temperature }}℃</strong>
        <span>{{ weather.city }} · {{ weather.condition }}</span>
        <small>天气实况 · {{ weather.updatedAt }}</small></p>
    </form>
    <form v-if="routeOptimizationEnabled" class="card tools" @submit.prevent="query('route')">
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
          <a v-if="stop.url" :href="stop.url" target="_blank" rel="noopener noreferrer">打开地图查看这一段 ›</a>
        </li>
      </ol>
    </section>
    </template>
  </main>
</template>

<style scoped>
.tools { margin-top: 16px; overflow-wrap: anywhere; }
.temperature { font-size: 26px; margin-right: 10px; }
.tools small { display: block; margin-top: 4px; }
.tools ol { padding-inline-start: 20px; }
.tools li { margin-block: 12px; }
.tools a { display: block; color: #1a55d9; }
</style>
