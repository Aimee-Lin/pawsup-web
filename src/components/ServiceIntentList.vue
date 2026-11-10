<script setup lang="ts">
import {ref} from 'vue'
import {store} from '../stores/community'
import {cloudApplications,applicationsState,syncApplications,cancelServiceIntent,intentMessagingEnabled,loadIntentMessages,sendIntentMessage} from '../services/remoteApplications'
import type {IntentMessage} from '../services/remoteApplications'
import type {ServiceApplication} from '../types'
defineProps<{items:ServiceApplication[]}>()
function applicantLabel(intent:ServiceApplication){
 const name=intent.applicantName?.trim()
 return name&&name!=='铲屎官'?name:'未设置昵称'
}
const openId=ref('')
const messages=ref<IntentMessage[]>([])
const draft=ref('')
const messageError=ref('')
const loading=ref(false)
const sending=ref(false)
let request=0

async function refreshMessages(id:string){
 const sequence=++request
 const owner=store.profile?.id
 loading.value=true
 messageError.value=''
 try{
  const rows=await loadIntentMessages(id)
  if(sequence===request&&owner===store.profile?.id)messages.value=rows
 }catch(e){
  if(sequence===request)messageError.value=(e as Error).message||'留言加载失败，请重试'
 }finally{
  if(sequence===request)loading.value=false
 }
}

function openConversation(id:string){
 ++request
 openId.value=openId.value===id?'':id
 messages.value=[]
 draft.value=''
 messageError.value=''
 if(openId.value)void refreshMessages(id)
}

async function send(id:string){
 if(sending.value||!draft.value.trim())return
 sending.value=true
 messageError.value=''
 try{
  await sendIntentMessage(id,draft.value)
  if(openId.value===id){
   draft.value=''
   await refreshMessages(id)
  }
 }catch(e){
  if(openId.value===id)messageError.value=(e as Error).message||'留言发送失败，请重试'
 }finally{sending.value=false}
}
const emit=defineEmits<{navigate:[]}>()
</script>
<template><section class="intent-list"><p>{{cloudApplications?'意向同步到云端，提交人与帖子作者可见，不构成预约或订单。':'本机记录，未发送给对方，不构成预约或订单。'}}</p><button v-if="cloudApplications" class="refresh-intents" :disabled="applicationsState.loading" @click="syncApplications().catch(()=>{})">{{applicationsState.loading?'正在同步…':'刷新服务意向'}}</button><p v-if="applicationsState.error" role="alert">加载失败：{{applicationsState.error}}</p><van-empty v-if="!items.length&&!applicationsState.error&&!applicationsState.loading" description="还没有服务意向"/><article v-for="a in items" :key="a.id"><span :class="{'intent-cancelled':a.received&&a.status==='cancelled'}">{{a.status==='pending'?(cloudApplications?'待沟通':'已记录，未发送'):a.received?'对方已取消':'已取消'}}</span><h3>{{a.title}}</h3><p v-if="a.received">{{a.direction==='buyer'?'咨询人':'接单人'}}：{{applicantLabel(a)}}</p><p v-else>{{a.direction==='buyer'?'找服务 · 咨询意向':'提供服务 · 接单意向'}}</p><small>{{new Date(a.createdAt).toLocaleDateString('zh-CN')}}</small><div><button v-if="intentMessagingEnabled&&a.remote" @click="openConversation(a.id)">{{openId===a.id?'收起留言':a.received?'联系对方':'查看留言'}}</button><RouterLink v-if="store.posts.some(p=>p.id===a.postId)" :to="'/posts/'+a.postId" @click="emit('navigate')">查看帖子</RouterLink><button v-if="!a.received&&a.status==='pending'" :disabled="applicationsState.busy[a.id]" @click="cancelServiceIntent(a.id)">{{applicationsState.busy[a.id]?'取消中…':'取消意向'}}</button></div><section v-if="openId===a.id" class="intent-thread">
 <button type="button" :disabled="loading" @click="refreshMessages(a.id)">{{loading?'正在读取…':'刷新留言'}}</button>
 <p v-if="messageError" role="alert">{{messageError}}</p>
 <p v-if="!messages.length&&!loading&&!messageError">还没有留言</p>
 <ul v-else-if="messages.length">
  <li v-for="message in messages" :key="message.id">
   <small>{{message.sender_id===store.profile?.id?'我':a.received?(applicantLabel(a)):'帖子作者'}} · {{new Date(message.created_at).toLocaleString('zh-CN')}}</small>
   <p>{{message.content}}</p>
  </li>
 </ul>
 <form v-if="a.status==='pending'" @submit.prevent="send(a.id)">
  <textarea v-model="draft" maxlength="500" rows="2" aria-label="留言内容" placeholder="给对方留个言" :disabled="sending"/>
  <button type="submit" :disabled="sending||!draft.trim()">{{sending?'发送中…':'发送留言'}}</button>
 </form>
 <p v-else>意向已取消，仍可查看历史留言。</p>
 </section></article></section></template>
<style scoped>.intent-list>p{font-size:11px;line-height:1.7;color:#8b7b99;margin:10px 0}.refresh-intents{border:0;background:transparent;color:#2563eb;padding:8px 0;font-size:12px}.intent-list article{padding:15px;border:1px solid #e7ddf3;border-radius:18px;background:#f8f5fd;margin:12px 0}.intent-list article>span{font-size:10px;color:#8b7b99}.intent-list h3{font-size:14px;margin:6px 0;overflow-wrap:anywhere}.intent-list article p{font-size:12px;color:#6b6086;margin:6px 0}.intent-list small{font-size:10px;color:#9a86a6}.intent-list article>div{display:flex;gap:18px;margin-top:12px}.intent-list article a,.intent-list article button{border:0;background:transparent;font-size:12px;color:#2563eb;padding:0}.intent-list button:disabled{opacity:.5}
.intent-list article>span.intent-cancelled{color:#b43b3d;font-weight:650}
.intent-thread{border-top:1px solid #e7ddf3;margin-top:12px;padding-top:12px}
.intent-thread ul{list-style:none;padding:0;margin:8px 0;max-height:240px;overflow:auto}
.intent-thread li{padding:8px 0;border-bottom:1px solid #e7ddf3}
.intent-thread li p{white-space:pre-wrap;overflow-wrap:anywhere}
.intent-thread textarea{width:100%;box-sizing:border-box;border:1px solid #e7ddf3;border-radius:8px;padding:8px;margin:6px 0}
</style>
