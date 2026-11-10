import {reactive} from 'vue'
import {supabase} from './supabase'
import {cloudApp,cloudSession,cloudbaseTable} from './cloudbase'
import {requireRemoteUser} from './backend'
import {store} from '../stores/community'
import {shoppingFromRows,shoppingQuantity} from './shoppingMapping'
export const cloudShopping=!!(supabase||cloudApp)
function favoritesTable(){
 return cloudApp?cloudbaseTable('pawsup_product_favorites'):supabase!.from('product_favorites')
}
function cartTable(){
 return cloudApp?cloudbaseTable('pawsup_cart_items'):supabase!.from('cart_items')
}
async function shoppingUser(){
 const user=cloudApp?await cloudSession():await requireRemoteUser()
 if(!user?.id||user.id!==store.profile?.id)throw Error('请重新登录后再试')
 return {id:user.id}
}
export const shoppingState=reactive({loading:false,error:'',busy:{} as Record<string,boolean>})
let owner='',pending:Promise<void>|undefined
function checked<T>(result:{data:T;error:unknown}):T{if(result.error)throw result.error;return result.data}
export async function syncShopping():Promise<void>{
 if(!cloudShopping||!store.profile?.id)return
 if(pending){await pending;if(owner===store.profile?.id)return;return syncShopping()}
 const userId=store.profile.id
 shoppingState.loading=true;shoppingState.error=''
 pending=(async()=>{await Promise.resolve();try{
 if(owner!==userId){if(!owner&&(store.savedProducts.length||Object.keys(store.cart).length)&&!localStorage.getItem('pawsup_legacy_shopping_backup_v1'))localStorage.setItem('pawsup_legacy_shopping_backup_v1',JSON.stringify({savedProducts:store.savedProducts,cart:store.cart}));store.savedProducts=[];store.cart={};owner=userId}
 const results=await Promise.all([favoritesTable().select('product_id').eq('owner_id',userId),cartTable().select('product_id,quantity').eq('owner_id',userId)])
 const favorites=checked(results[0])||[],cart=checked(results[1])||[]
 if(store.profile?.id===userId){const mapped=shoppingFromRows(favorites,cart);store.savedProducts=mapped.savedProducts;store.cart=mapped.cart}
 }catch(e){shoppingState.error=(e as Error).message||'好物数据加载失败';throw e}finally{shoppingState.loading=false;pending=undefined}})()
 return pending
}
async function mutate(key:string,action:()=>Promise<void>){if(shoppingState.loading||shoppingState.error)throw Error('请先刷新云端好物数据后重试');if(shoppingState.busy[key])return false;shoppingState.busy[key]=true;try{await action();return true}finally{delete shoppingState.busy[key]}}
export async function saveFavorite(id:string){return mutate('favorite:'+id,async()=>{const user=await shoppingUser(),exists=store.savedProducts.includes(id);checked(await(exists?favoritesTable().delete().eq('owner_id',user.id).eq('product_id',id):favoritesTable().insert({product_id:id,...(cloudApp?{}:{owner_id:user.id})})));if(store.profile?.id===user.id)store.savedProducts=exists?store.savedProducts.filter(value=>value!==id):[...store.savedProducts,id]})}
export async function saveCartQuantity(id:string,value:number|null){return mutate('cart:'+id,async()=>{const user=await shoppingUser();if(value===null){checked(await cartTable().delete().eq('owner_id',user.id).eq('product_id',id));if(store.profile?.id===user.id)delete store.cart[id];return}const quantity=shoppingQuantity(value);checked(await cartTable().upsert({product_id:id,quantity,...(cloudApp?{}:{owner_id:user.id})},{onConflict:'owner_id,product_id'}));if(store.profile?.id===user.id)store.cart[id]=quantity})}
