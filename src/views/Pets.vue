<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {showConfirmDialog,showToast} from 'vant'
import {store,currentPets,image,compressImage} from '../stores/community'
import {supabase} from '../services/supabase'
import {cloudPetsEnabled,syncRemotePets,saveRemotePet,deleteRemotePet,remotePetsState} from '../services/remotePets'
import type {Pet} from '../types'
const route=useRoute(),router=useRouter()
const localDraftPets=computed(()=>supabase&&store.profile?store.pets.filter(p=>p.ownerId===store.profile!.email&&!p.cloudId):[])
const saving=ref(false),uploading=ref(false),formError=ref('')
const open=ref(false),editing=ref(''),form=ref({name:'',species:'猫',breed:'',age:'',photo:'',bio:''})
function edit(p?:Pet){formError.value='';editing.value=p?.id||'';form.value=p?{...p}:{name:'',species:'猫',breed:'',age:'',photo:'',bio:''};open.value=true}
async function pick(e:Event){const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;uploading.value=true;try{form.value.photo=await compressImage(f)}catch(e){showToast((e as Error).message)}finally{uploading.value=false}}
async function save(){
 if(!store.profile||!form.value.name.trim()||uploading.value||saving.value)return
 saving.value=true;formError.value=''
 try{
  if(cloudPetsEnabled)await saveRemotePet(form.value,editing.value||undefined)
  else{
   const owner=store.profile.email
   const pet={...form.value,ownerId:owner,name:form.value.name.trim(),photo:form.value.photo||image(form.value.species==='猫'?'pet-yunduo':'pet-buding'),id:editing.value||crypto.randomUUID()}
   if(editing.value){const index=store.pets.findIndex(p=>p.id===editing.value&&p.ownerId===owner);if(index<0)throw Error('未找到你的宠物档案');store.pets[index]=pet}else store.pets.push(pet)
  }
  open.value=false;showToast(cloudPetsEnabled?'宠物档案已保存到云端':'档案已保存到本机')
  const next=String(route.query.next||'');if(['/publish','/outing'].includes(next.split('?')[0]||'')||/^\/posts\/[a-zA-Z0-9-]+$/.test(next))router.replace(next)
 }catch(e){formError.value=e instanceof Error?e.message:'保存失败，请重试'}finally{saving.value=false}
}

watch(()=>route.query.add,value=>{if(value==='1')edit()},{immediate:true})
async function migrate(pet:Pet){if(saving.value)return;saving.value=true;try{const remote=await saveRemotePet(pet);pet.cloudId=remote.id;showToast('本地档案已同步到云端')}catch(e){showToast(e instanceof Error?e.message:'同步失败，请重试')}finally{saving.value=false}}
async function remove(id:string){
 try{await showConfirmDialog({title:'删除宠物档案',message:cloudPetsEnabled?'确定删除云端的这份宠物档案吗？':'确定删除这份本地档案吗？'})}catch{return}
 try{if(cloudPetsEnabled)await deleteRemotePet(id);else store.pets=store.pets.filter(p=>p.id!==id||p.ownerId!==store.profile?.email);showToast('档案已删除')}catch(e){showToast(e instanceof Error?e.message:'删除失败，请重试')}
}

</script>
<template><main><header class="page-header"><div><span class="eyebrow">MY LITTLE FAMILY</span><h1>我的毛孩子</h1><p>每一个名字，都是独一无二的陪伴。</p></div><button class="round-button" @click="edit()" aria-label="添加宠物"><van-icon name="plus"/></button></header><div v-if="cloudPetsEnabled" class="pet-sync-state"><span>{{remotePetsState.loading?'正在读取云端档案…':remotePetsState.error?'云端档案读取失败':'已连接云端宠物档案'}}</span><button :disabled="remotePetsState.loading" @click="syncRemotePets(true).catch(()=>{})">重新加载</button></div><p v-if="remotePetsState.error" class="form-error" role="alert">{{remotePetsState.error}}</p><section v-if="localDraftPets.length" class="local-pet-drafts"><h3>发现 {{localDraftPets.length}} 份本地宠物档案</h3><p>之前创建的档案仍在本机，点击同步后才会上传到当前账号。</p><div v-for="pet in localDraftPets" :key="pet.id"><span>{{pet.name}}</span><button :disabled="saving" @click="migrate(pet)">同步这份档案</button></div></section><van-empty v-if="!currentPets.length&&!remotePetsState.loading&&!remotePetsState.error" description="为第一位家庭成员建立档案"><van-button round color="#a078b9" @click="edit()">添加毛孩子</van-button></van-empty><article v-for="pet in currentPets" :key="pet.id" class="card pet-card"><img class="pet-portrait" :src="pet.photo" :alt="pet.name"/><div><span class="pill">{{pet.species}} · {{pet.age||'年龄待填写'}}</span><h2>{{pet.name}}</h2><p>{{pet.breed||'品种待填写'}}</p><p class="muted">{{pet.bio||'关于它的故事，等你慢慢记录。'}}</p><button @click="edit(pet)" class="soft-button">编辑档案</button> <button class="text-button" @click="remove(pet.id)">删除</button></div></article><van-popup v-model:show="open" position="bottom" round closeable><div class="pet-form"><h2>{{editing?'编辑档案':'认识新的家人'}}</h2><label class="photo-picker"><img :src="form.photo||image(form.species==='猫'?'pet-yunduo':'pet-buding')" alt="宠物头像"/><span>点击更换头像</span><input type="file" accept="image/jpeg,image/png,image/webp" @change="pick"/></label><van-form @submit="save"><van-field v-model="form.name" label="名字" placeholder="毛孩子叫什么" maxlength="18" :rules="[{validator:v=>!!v.trim(),message:'请填写名字'}]"/><div class="chips"><button v-for="s in ['猫','狗','其他']" :key="s" type="button" :class="{active:form.species===s}" @click="form.species=s">{{s}}</button></div><van-field v-model="form.breed" label="品种" placeholder="例如：布偶猫" maxlength="30"/><van-field v-model="form.age" label="年龄" placeholder="例如：2 岁" maxlength="15"/><van-field v-model="form.bio" label="小介绍" type="textarea" placeholder="性格、喜好和小习惯" maxlength="200"/><p v-if="formError" class="form-error" role="alert">{{formError}}</p><van-button block round native-type="submit" :loading="saving" :disabled="uploading" color="#a078b9">保存档案</van-button></van-form></div></van-popup></main></template>

<style scoped>.pet-sync-state{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#9a86a6;margin:-8px 0 20px}.pet-sync-state button{background:#ffffffaa;border:1px solid #e7ddf3;border-radius:15px;padding:6px 10px;color:#8b6cc9;font-size:11px}.local-pet-drafts{padding:15px;border:1px solid white;border-radius:18px;background:#fff6e9;margin-bottom:20px}.local-pet-drafts h3{font-size:13px;color:#9d805b}.local-pet-drafts p{font-size:10px;color:#ac957a;margin:6px 0 12px}.local-pet-drafts>div{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:#8b7598}.local-pet-drafts button{border:1px solid #dbc9ae;background:white;border-radius:15px;padding:7px 10px;color:#9d805b;font-size:11px}.local-pet-drafts button:disabled{opacity:.5}</style>
