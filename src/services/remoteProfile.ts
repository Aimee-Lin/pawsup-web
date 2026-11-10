import {reactive} from 'vue'
import {supabase} from './supabase'
import {cloudApp,cloudSession,cloudbaseTable} from './cloudbase'
import {backend,requireRemoteUser} from './backend'
import {store} from '../stores/community'
import {profileFields} from './profileMapping'
import type {RemoteProfileRow} from './profileMapping'
export const cloudProfiles=!!(supabase||cloudApp)
const columns='id,display_name,avatar_path,bio'
const avatarBucket='pawsup-avatars'
export async function initializeCloudbaseNickname(name:string){
 const nickname=[...name.trim()].slice(0,24).join('')
 if(!cloudApp||!nickname||nickname==='铲屎官')return
 const {error}=await cloudbaseTable('pawsup_profiles')
  .upsert({display_name:nickname},{onConflict:'id',ignoreDuplicates:true})
 if(error)throw error
}
export const profileState=reactive({loading:false,error:'',imageError:false,ownerId:'',name:'',photo:'',bio:'',avatarPath:null as string|null})
let loadedAt=0,pending:Promise<void>|undefined
async function apply(row:RemoteProfileRow){
 let photo='';let imageError=false
 if(row.avatar_path){try{if(cloudApp){
   const {data,error}=await cloudApp.storage.from(avatarBucket).createSignedUrl(row.avatar_path,300)
   if(error||!data?.fullSignedURL)throw Error('头像暂时无法读取')
   photo=data.fullSignedURL
  }else photo=await backend.imageUrl('avatars',row.avatar_path)}catch{imageError=true}}
 if(store.profile?.id!==row.id)return
 Object.assign(profileState,{ownerId:row.id,name:row.display_name,bio:row.bio,avatarPath:row.avatar_path,photo,imageError});store.profile.name=row.display_name;loadedAt=Date.now()
}
export async function syncProfile(force=false):Promise<void>{
 if(!cloudProfiles||!store.profile?.id)return
 const id=store.profile.id
 if(!force&&profileState.ownerId===id&&Date.now()-loadedAt<180000){store.profile.name=profileState.name;return}
 if(pending){await pending;return syncProfile(force)}
 if(profileState.ownerId!==id)Object.assign(profileState,{ownerId:'',name:'',photo:'',bio:'',avatarPath:null,imageError:false})
 profileState.loading=true;profileState.error=''
 const fallbackName=store.profile.name
 pending=(async()=>{
  try{
   const {data,error}=cloudApp
    ?await cloudbaseTable('pawsup_profiles').select(columns).eq('id',id).maybeSingle()
    :await supabase!.from('profiles').select(columns).eq('id',id).single()
   if(error)throw error
   if(!data&&!cloudApp)throw Error('个人资料不存在，请联系维护人员')
   if(!data&&cloudApp&&store.profile?.id===id)await initializeCloudbaseNickname(fallbackName)
   await apply(data??{id,display_name:fallbackName,bio:'',avatar_path:null})
  }catch(e){
   profileState.error=(e as Error).message||'个人资料加载失败'
   throw e
  }finally{
   profileState.loading=false
   pending=undefined
  }
 })()
 return pending
}
export async function saveProfile(input:{name:string;bio:string;photo:string}){
 const user=cloudApp?await cloudSession():await requireRemoteUser()
 if(!user?.id||user.id!==store.profile?.id)throw Error('请重新登录后再试')
 if(profileState.ownerId!==user.id||profileState.error)throw Error('请先刷新云端资料后重试')
 const previousAvatar=profileState.avatarPath
 const fields=profileFields(input.name,input.bio,previousAvatar)
 if(input.photo.startsWith('data:image/')){
  const blob=await(await fetch(input.photo)).blob()
  if(cloudApp){
   const path=`${user.id}/${crypto.randomUUID()}.jpg`
   const {error}=await cloudApp.storage.from(avatarBucket).upload(path,blob,{contentType:blob.type})
   if(error)throw error
   fields.avatar_path=path
  }else fields.avatar_path=await backend.upload('avatars',new File([blob],'avatar.jpg',{type:blob.type}))
 }
 if(store.profile?.id!==user.id)throw Error('登录账号已切换，请重试')
 const {data,error}=cloudApp
  ?await cloudbaseTable('pawsup_profiles').upsert(fields,{onConflict:'id'}).select(columns).single()
  :await supabase!.from('profiles').update(fields).eq('id',user.id).select(columns).single()
 if(error)throw error
 if(!data)throw Error('个人资料保存失败')
 await apply(data as RemoteProfileRow)
 if(cloudApp&&previousAvatar&&fields.avatar_path!==previousAvatar&&store.profile?.id===user.id){
  await cloudApp.storage.from(avatarBucket).remove([previousAvatar]).catch(()=>{})
 }
}
