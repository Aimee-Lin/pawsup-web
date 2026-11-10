import {reactive} from 'vue'
import {supabase} from './supabase'
import {cloudApp} from './cloudbase'
import {cloudbasePets} from './cloudbasePets'
import {backend} from './backend'
import {store,image} from '../stores/community'
import {petFields,petFromRow} from './petMapping'
import type {RemotePetRow} from './petMapping'
import type {Pet} from '../types'
export const cloudPetsEnabled=!!(supabase||cloudApp)
export const remotePetsState=reactive({loading:false,error:''})
let loadedOwner='',loadedAt=0,pending:Promise<void>|null=null
export async function mapRemotePet(row:RemotePetRow):Promise<Pet>{return petFromRow(row,image(row.species==='cat'?'pet-yunduo':'pet-buding'),path=>cloudApp?cloudbasePets.imageUrl(path):backend.imageUrl('pet-photos',path))}
export async function syncRemotePets(force=false):Promise<void>{
 if(!cloudPetsEnabled||!store.profile?.id)return
 const owner=store.profile.id
 if(!force&&loadedOwner===owner&&Date.now()-loadedAt<180000)return
 if(pending){await pending;if(loadedOwner===owner&&!force)return}
 remotePetsState.loading=true;remotePetsState.error=''
 pending=(async()=>{try{const rows=await (cloudApp?cloudbasePets.list(owner):backend.pets());const pets=await Promise.all((rows as RemotePetRow[]).map(mapRemotePet));if(store.profile?.id===owner){store.pets=[...store.pets.filter(p=>p.ownerId!==owner),...pets];loadedOwner=owner;loadedAt=Date.now()}}catch(e){remotePetsState.error=e instanceof Error?e.message:'宠物档案加载失败，请重试';throw e}finally{remotePetsState.loading=false}})()
 try{await pending}finally{pending=null}
}
export async function saveRemotePet(form:{name:string;species:string;breed:string;age:string;bio:string;photo:string},id?:string):Promise<Pet>{
 const owner=store.profile?.id
 if(!owner)throw Error('请先登录')
 const existing=id?store.pets.find(p=>p.id===id&&p.ownerId===owner):undefined
 if(id&&!existing)throw Error('未找到你的宠物档案')
 const fields=petFields(form)
 let photoPath=existing?.photoPath
 let uploaded: string|undefined
 if(form.photo.startsWith('data:image/')){
  const blob=await (await fetch(form.photo)).blob()
  uploaded=cloudApp?await cloudbasePets.upload(owner,blob):await backend.upload('pet-photos',new File([blob],'pet.jpg',{type:blob.type}))
  photoPath=uploaded
 }
 const input={...fields,...photoPath?{photo_path:photoPath}:{}}
 if(store.profile?.id!==owner)throw Error('登录账号已切换，请重试')
 const row=cloudApp?await cloudbasePets.save(owner,input,id):
  (id?await backend.updatePet(id,input):await backend.createPet(input)) as RemotePetRow
 if(cloudApp&&uploaded&&existing?.photoPath)await cloudbasePets.removePhoto(existing.photoPath).catch(()=>{})
 const pet=await mapRemotePet(row)
 if(store.profile?.id!==owner)return pet
 const index=store.pets.findIndex(p=>p.id===pet.id&&p.ownerId===owner)
 if(index>=0)store.pets[index]=pet;else store.pets.push(pet)
 loadedOwner=owner;loadedAt=Date.now();return pet
}
export async function deleteRemotePet(id:string){
 const owner=store.profile?.id
 const pet=store.pets.find(p=>p.id===id&&p.ownerId===owner)
 if(!owner||!pet)throw Error('未找到你的宠物档案')
 if(cloudApp)await cloudbasePets.remove(id)
 else await backend.deletePet(id)
 store.pets=store.pets.filter(p=>p.id!==id||p.ownerId!==owner)
 if(cloudApp&&pet.photoPath)await cloudbasePets.removePhoto(pet.photoPath).catch(()=>{})
}
