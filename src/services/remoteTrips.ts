import {reactive} from 'vue'
import {supabase} from './supabase'
import {cloudApp,cloudSession,cloudbaseTable} from './cloudbase'
import {requireRemoteUser} from './backend'
import {store,currentPets} from '../stores/community'
import {tripFields,tripFromRow} from './tripMapping'
import type {RemoteTripRow} from './tripMapping'
import type {Trip} from '../types'
export const cloudTrips=!!(supabase||cloudApp)
function tripTable(){
 return cloudApp?cloudbaseTable('pawsup_trips'):supabase!.from('trips')
}
async function tripUser(){
 const user=cloudApp?await cloudSession():await requireRemoteUser()
 if(!user?.id||user.id!==store.profile?.id)throw Error('请重新登录后再试')
 return {id:user.id}
}
export const tripsState=reactive({loading:false,error:''})
let loadedOwner='',pending:Promise<void>|undefined
export async function syncTrips():Promise<void>{
 if(!cloudTrips||!store.profile?.id)return
 if(pending){await pending;if(loadedOwner===store.profile?.id)return;return syncTrips()}
 const userId=store.profile.id
 tripsState.loading=true;tripsState.error=''
 pending=(async()=>{try{await Promise.resolve();
 if(loadedOwner!==userId){
 const legacy=store.trips.filter(t=>!t.remote)
 if(legacy.length&&!localStorage.getItem('pawsup_legacy_trips_backup_v1'))localStorage.setItem('pawsup_legacy_trips_backup_v1',JSON.stringify(legacy))
 store.trips=[];loadedOwner=userId
 }
 const rows:RemoteTripRow[]=[]
 const pageSize=100
 for(let offset=0;;offset+=pageSize){
  const {data,error}=await tripTable().select('*').eq('owner_id',userId)
   .order('departure_at',{ascending:false}).order('id').range(offset,offset+pageSize-1)
  if(error)throw error
  if(store.profile?.id!==userId)return
  const page=(data??[]) as RemoteTripRow[]
  rows.push(...page)
  if(page.length<pageSize)break
 }
 store.trips=rows.map(row=>tripFromRow(row,currentPets.value))
 }catch(e){tripsState.error=(e as Error).message||'行程加载失败';throw e}finally{tripsState.loading=false;pending=undefined}})()
 return pending
}
export async function saveCloudTrip(trip:Trip,editing=false){
 const user=await tripUser()
 if(!trip.petIds.length||trip.petIds.some(id=>!currentPets.value.some(p=>p.id===id)))throw Error('同行宠物档案已变更，请重新选择')
 const fields=tripFields(trip)
 const insertFields={...fields,...(cloudApp?{}:{owner_id:user.id})}
 const {data,error}=await(editing?tripTable().update(fields).eq('id',trip.id).eq('owner_id',user.id):tripTable().insert(insertFields)).select().single()
 if(error)throw error;if(!data)throw Error('行程不存在或无权修改')
 const saved=tripFromRow(data as RemoteTripRow,currentPets.value)
 if(store.profile?.id===user.id){const index=store.trips.findIndex(t=>t.id===saved.id);if(index<0)store.trips.unshift(saved);else store.trips.splice(index,1,saved)}
 return saved
}
export async function deleteCloudTrip(id:string){
 const user=await tripUser();const {data,error}=await tripTable().delete().eq('id',id).eq('owner_id',user.id).select('id')
 if(error)throw error;if(!data?.length)throw Error('行程不存在或无权删除')
 if(store.profile?.id===user.id)store.trips=store.trips.filter(t=>t.id!==id)
}
