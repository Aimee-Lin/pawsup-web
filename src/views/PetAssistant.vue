<script setup lang="ts">
import { ref } from 'vue'
import { cloudApp } from '../services/cloudbase'
import { supabase } from '../services/supabase'

const question = ref('')
const busy = ref(false)
const error = ref('')
const messages = ref<{ question: string; answer: string }[]>([])

async function ask() {
  const input = question.value.trim()
  if (!input || busy.value) return
  if (!supabase) {
    error.value = 'AI 问答需要登录云端账号'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const result = await supabase.functions.invoke('pet-assistant', { body: { question: input } })
    if (result.error || !result.data?.answer) {
      error.value = result.data?.error || '暂时未能获取回答，请重试'
      return
    }
    messages.value.push({ question: input, answer: result.data.answer })
    question.value = ''
  } catch {
    error.value = '暂时未能获取回答，请重试'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main>
    <RouterLink class="back" to="/">‹ 返回首页</RouterLink>
    <h1>AI 宠物助手</h1>
    <p v-if="cloudApp" class="muted">AI 宠物助手暂未开放。</p>
    <template v-else>
    <p class="muted">可以询问日常喂养、护理和出行准备。回答仅供参考，宠物出现急症请立即联系兽医。</p>
    <section v-for="(message, index) in messages" :key="index" class="card answer">
      <h2>{{ message.question }}</h2>
      <p>{{ message.answer }}</p>
    </section>
    <form class="card answer" @submit.prevent="ask">
      <van-field v-model="question" label="问题" type="textarea" autosize maxlength="1000"
        placeholder="比如：第一次带猫坐车，要准备什么？" :disabled="busy" />
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <van-button block round native-type="submit" type="primary" :loading="busy" :disabled="!question.trim()">提问</van-button>
    </form>
    </template>
  </main>
</template>

<style scoped>
.answer { margin-top: 18px; overflow-wrap: anywhere; }
.answer p { white-space: pre-wrap; }
</style>
