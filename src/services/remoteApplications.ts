import {reactive} from 'vue'
import {showConfirmDialog,showToast} from 'vant'
import {supabase} from './supabase'
import {cloudApp,cloudbaseTable,requireCloudbaseUser} from './cloudbase'
import {requireRemoteUser} from './backend'
import {store,currentPets} from '../stores/community'
import {applicationFromRow} from './applicationMapping'
import type {RemoteApplicationRow} from './applicationMapping'
import type {Post} from '../types'
export const cloudApplications=!!(cloudApp||supabase)
function applicationsTable(){
 return cloudApp?cloudbaseTable('pawsup_service_applications'):supabase!.from('service_applications')
}
async function applicationUser(){
 return cloudApp?requireCloudbaseUser(store.profile?.id):requireRemoteUser()
}
export const applicationsState=reactive({loading:false,error:'',busy:{} as Record<string,boolean>})
let owner='',pending:Promise<void>|undefined
export async function syncApplications():Promise<void>{
 if(!cloudApplications||!store.profile?.id)return
 if(pending){await pending;if(owner===store.profile?.id)return;return syncApplications()}
 const userId=store.profile.id;applicationsState.loading=true;applicationsState.error=''
 pending=(async()=>{await Promise.resolve();try{
 if(owner!==userId){const old=store.applications.filter(a=>!a.remote);if(old.length&&!localStorage.getItem('pawsup_legacy_applications_backup_v1'))localStorage.setItem('pawsup_legacy_applications_backup_v1',JSON.stringify(old));store.applications=[];owner=userId}
 const selection=cloudApp
  ?'id,applicant_id,applicant_name,post_id,direction,status,created_at,posts:pawsup_posts(title,owner_id)'
  :'id,applicant_id,post_id,direction,status,created_at,posts(title,owner_id)'
 const rows:Array<RemoteApplicationRow & {applicant_name?:string}>=[]
 for(let offset=0;;offset+=100){
  const {data,error}=await applicationsTable().select(selection)
   .order('created_at',{ascending:false}).order('id').range(offset,offset+99)
  if(error)throw error
  const page=(data??[]) as unknown as typeof rows
  rows.push(...page)
  if(page.length<100)break
 }
 const ids=[...new Set(rows.map(r=>r.applicant_id))]
 const profiles=!cloudApp&&ids.length?await supabase!.from('profiles').select('id,display_name').in('id',ids):{data:[],error:null}
 if(profiles.error)throw profiles.error
 const names=new Map((profiles.data||[]).map(p=>[p.id,p.display_name]))
 if(store.profile?.id===userId)store.applications=rows.map(row=>{
  const application=applicationFromRow(row,userId,names)
  if(row.applicant_name?.trim())application.applicantName=row.applicant_name
  return application
 })
 }catch(e){applicationsState.error=(e as Error).message||'服务意向加载失败';throw e}finally{applicationsState.loading=false;pending=undefined}})()
 return pending
}
export async function createApplication(post:Post){
 if(applicationsState.busy[post.id])return false
 if(applicationsState.error||applicationsState.loading)throw Error('请先刷新服务意向后重试')
 applicationsState.busy[post.id]=true
 try{const user=await applicationUser();if(!post.remote||post.kind!=='service'||post.ownerId===user.id)throw Error('只能向其他用户的服务帖子提交意向');if(!currentPets.value.length)throw Error('请先添加宠物档案');if(store.applications.some(a=>!a.received&&a.postId===post.id&&a.status==='pending'))throw Error('已经提交过意向，请勿重复提交')
 const {data,error}=await applicationsTable().insert({post_id:post.id,direction:post.serviceRole==='offer'?'buyer':'provider',...(cloudApp?{}:{applicant_id:user.id})}).select('id,applicant_id,post_id,direction,status,created_at').single()
 if(error){if(error.code==='23505')throw Error('已经提交过意向，请刷新查看');throw error}if(!data)throw Error('意向保存失败')
 if(store.profile?.id===user.id)store.applications.unshift(applicationFromRow({...data,posts:{title:post.title,owner_id:post.ownerId!}},user.id,new Map([[user.id,store.profile.name]])))
 return true
 }finally{delete applicationsState.busy[post.id]}
}
export async function cancelServiceIntent(id:string){
 try{await showConfirmDialog({title:'取消服务意向',message:cloudApplications?'取消后对方也能看到取消状态；此操作不涉及订单或退款。':'仅取消本机意向记录。'})}catch{return}
 if(applicationsState.busy[id])return;applicationsState.busy[id]=true
 try{if(cloudApplications){const user=await applicationUser();const {data,error}=await applicationsTable().update({status:'cancelled'}).eq('id',id).eq('applicant_id',user.id).eq('status','pending').select('id');if(error)throw error;if(!data?.length)throw Error('意向已取消或没有操作权限')}
 const item=store.applications.find(a=>a.id===id&&!a.received);if(item)item.status='cancelled';showToast('意向已取消')
 }catch(e){showToast((e as Error).message||'取消失败，请重试')}finally{delete applicationsState.busy[id]}
}


const localApi = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(import.meta.env.VITE_SUPABASE_URL || '')
export const intentMessagingEnabled=!!(cloudApp||(supabase&&localApi))
function intentMessagesTable(){
 return cloudApp?cloudbaseTable('pawsup_intent_messages'):supabase!.from('intent_messages')
}
export interface IntentMessage {
 id:string
 sender_id:string
 content:string
 created_at:string
}

export async function loadIntentMessages(applicationId:string){
 await applicationUser()
 const {data,error}=await intentMessagesTable()
  .select('id,sender_id,content,created_at').eq('application_id',applicationId)
  .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100)
 if(error)throw error
 return ((data??[]) as IntentMessage[]).reverse()
}

export async function sendIntentMessage(applicationId:string,content:string){
 await applicationUser()
 const {error}=await intentMessagesTable()
  .insert({application_id:applicationId,content:content.trim()})
 if(error)throw error
}
