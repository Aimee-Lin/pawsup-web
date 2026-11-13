<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRoute } from 'vue-router'
import { askPetAssistant, assistantDemo, assistantEnabled, assistantExamples } from '../services/v2Tools'

import type { AssistantTurn } from '../services/v2Tools'

const route = useRoute()
const question = ref(assistantExamples.find(example => example.question === route.query.question)?.question ?? '')
const pending = ref('')
const failed = ref('')
const error = ref('')
const messages = ref<AssistantTurn[]>([])
const latest = ref<HTMLElement>()

async function showLatest() {
  await nextTick()
  latest.value?.scrollIntoView({ block: 'nearest' })
}

function newConversation() {
  messages.value = []
  question.value = ''
  failed.value = ''
  error.value = ''
}

async function ask(input = question.value) {
  const text = input.trim()
  if (!text || pending.value) return
  pending.value = text
  failed.value = ''
  error.value = ''
  question.value = ''
  void showLatest()
  try {
    messages.value.push({ question: text, answer: await askPetAssistant(text, messages.value) })
  } catch (cause) {
    failed.value = text
    error.value = cause instanceof Error ? cause.message : '暂时未能获取回答，请重试'
  } finally {
    pending.value = ''
    void showLatest()
  }
}
</script>

<template>
  <main class="assistant">
    <RouterLink class="back" to="/">‹ 返回首页</RouterLink>
    <header class="assistant-intro">
      <div>
        <span v-if="assistantDemo" class="pill">本地演示</span>
        <h1>AI 宠物助手</h1>
        <p>带毛孩子出门，交通、住宿和应急问题都可以问。</p>
      </div>
      <van-button v-if="assistantEnabled" size="small" round plain
        :disabled="!!pending || (!messages.length && !failed)" @click="newConversation">
        新对话
      </van-button>
    </header>
    <p v-if="!assistantEnabled" class="muted">AI 宠物助手暂未开放。</p>
    <template v-else>
      <section class="chat-thread" aria-label="对话记录" role="log">
        <div v-if="!messages.length && !pending && !failed" class="bubble bubble-assistant">
          <span class="speaker">PawsUp 助手</span>
          <p>你好！准备带毛孩子去哪儿？我们一起做出行准备吧。</p>
          <p v-if="assistantDemo" class="muted">本地演示使用预设回答。</p>
          <button v-for="example in assistantExamples" :key="example.question"
            class="suggestion" type="button" @click="question = example.question">
            {{ example.question }}
          </button>
        </div>
        <template v-for="(message, index) in messages" :key="index">
          <div class="bubble bubble-user"><span class="speaker">你</span><p>{{ message.question }}</p></div>
          <div class="bubble bubble-assistant"><span class="speaker">PawsUp 助手</span><p>{{ message.answer }}</p></div>
        </template>
        <template v-if="pending || failed">
          <div class="bubble bubble-user"><span class="speaker">你</span><p>{{ pending || failed }}</p></div>
          <div class="bubble bubble-assistant">
            <span class="speaker">PawsUp 助手</span>
            <p v-if="pending" role="status">正在回答…</p>
            <template v-else>
              <p class="form-error" role="alert">{{ error }}</p>
              <van-button size="small" round plain type="primary" @click="ask(failed)">重试</van-button>
            </template>
          </div>
        </template>
        <div ref="latest"></div>
      </section>
      <form class="composer" @submit.prevent="ask()">
        <div class="composer-row">
          <van-field v-model="question" type="textarea" rows="2" maxlength="1000" aria-label="你的问题"
            :placeholder="messages.length ? '接着问…' : '输入你想问的问题…'" :disabled="!!pending" />
          <van-button round native-type="submit" type="primary" :loading="!!pending"
            :disabled="!question.trim()">发送</van-button>
        </div>
        <p class="muted assistant-note">回答仅供出行参考。宠物出现急症请立即联系兽医。</p>
      </form>
    </template>
  </main>
</template>

<style scoped>
.assistant { display: grid; gap: 12px; }
.assistant-intro { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px; border-radius: 18px; background: #eee3f8; }
.assistant-intro h1 { margin: 4px 0; font-size: 22px; }
.assistant-intro p { margin: 0; color: #695779; font-size: 13px; }
.assistant-intro .van-button { flex-shrink: 0; }
.chat-thread { display: flex; flex-direction: column; gap: 12px; min-height: 220px; max-height: 54dvh; overflow-y: auto; padding: 12px 4px; }
.bubble { width: fit-content; max-width: 88%; padding: 10px 14px; border-radius: 16px; overflow-wrap: anywhere; }
.bubble p { margin: 5px 0 0; white-space: pre-wrap; }
.bubble-user { align-self: flex-end; background: #eee1f7; border-bottom-right-radius: 4px; }
.bubble-assistant { align-self: flex-start; background: #fff; border: 1px solid #efe7f4; border-bottom-left-radius: 4px; }
.speaker, .assistant-note { font-size: 12px; color: #695779; }
.suggestion { display: block; margin-top: 8px; padding: 7px 10px; border: 0; border-radius: 10px; background: #f3eafb; color: #5e4675; text-align: left; }
.composer { position: sticky; bottom: 0; padding: 10px; border: 1px solid #efe7f4; border-radius: 16px; background: #fff; }
.composer-row { display: flex; align-items: flex-end; gap: 8px; }
.composer-row .van-field { flex: 1; min-width: 0; padding: 6px; }
.composer-row .van-button { flex-shrink: 0; }
.assistant-note { margin: 6px 0 0; }
</style>
