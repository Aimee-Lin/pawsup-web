import {cloudShopping,saveFavorite,saveCartQuantity} from '../services/remoteShopping'
import {cloudLike} from '../services/remoteCommunity'
import {showToast} from 'vant'
import {cloudApp} from '../services/cloudbase'
import {ownedPets} from '../services/petOwnership'
import {communitySamples} from '../services/community'
import { computed, reactive, watch } from 'vue'
import type { Pet,Post,Profile,Trip,ServiceApplication } from '../types'
import assets from '../assets.json'
export const image=(key:string)=>(assets as Record<string,string>)[key]||''
const seedPosts:Post[]=[{id:'sample-1',author:'布丁的快乐星球',avatar:image('pet-buding'),title:'周末的快乐，是毛孩子给的',content:'找到了一个超舒服的宠物友好公园！草坪很大，布丁跑得不想回家。记得牵绳、带水，也把快乐留给下一位朋友。',image:image('nearby-park'),category:'出行日记',likes:128,liked:false,createdAt:Date.now()-7200000,comments:[{id:'c1',author:'云朵麻麻',text:'已经加入周末清单啦！'}]},{id:'sample-2',author:'云朵麻麻',avatar:image('pet-yunduo'),title:'今天也被这张小脸治愈了',content:'午后的阳光、软软的毯子，还有打呼噜的小猫。平凡日子里最珍贵的小幸福。',image:image('pet-yunduo'),category:'养宠日常',likes:86,liked:false,createdAt:Date.now()-14400000,comments:[]},{id:'sample-3',author:'和棉花去散步',avatar:image('pet-mianhua'),title:'一起去喝一杯宠物友好咖啡',content:'安静的小院，适合带毛孩子一起放空。出发前记得和店家确认携宠规则哦。',image:image('nearby-cafe'),category:'出行日记',likes:62,liked:false,createdAt:Date.now()-86400000,comments:[]}]
const key=cloudApp?'pawsup_cloudbase_preview_v1':'pawsup_frontend_v1'
function initial(){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
const cached=initial()
export const store=reactive<{pets:Pet[];posts:Post[];profile:Profile|null;following:string[];trips:Trip[];applications:ServiceApplication[];communityVersion:number;savedProducts:string[];cart:Record<string,number>;profileDetails:Record<string,{photo:string;bio:string}>}>({pets:cloudApp?[]:cached?.pets||[],posts:cloudApp?[]:cached?.communityVersion===2?(cached.posts||seedPosts):[...(cached?.posts||seedPosts),...communitySamples],profile:null,following:cloudApp?[]:cached?.following||[],trips:cloudApp?[]:cached?.trips||[],applications:cloudApp?[]:cached?.applications||[],communityVersion:2,savedProducts:cloudApp?[]:cached?.savedProducts||[],cart:cloudApp?{}:cached?.cart||{},profileDetails:cached?.profileDetails||{}})
watch(store,()=>{try{localStorage.setItem(key,JSON.stringify(cloudApp?{...store,pets:[],posts:[],following:[],applications:[],trips:[],savedProducts:[],cart:{},profile:null}:store))}catch{window.dispatchEvent(new Event('pawsup-storage-error'))}},{deep:true})
const liking=new Set<string>()
export async function toggleLike(post:Post){if(post.remote){if(liking.has(post.id))return;liking.add(post.id);try{await cloudLike(post)}catch(e){showToast((e as Error).message)}finally{liking.delete(post.id)}return}post.liked=!post.liked;post.likes+=post.liked?1:-1}
export async function compressImage(file:File):Promise<string>{if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 图片');if(file.size>10*1024*1024)throw Error('请选择小于 10MB 的图片');return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{const scale=Math.min(1,1000/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,img.width*scale);canvas.height=Math.max(1,img.height*scale);canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',0.75))};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('图片读取失败'))};img.src=url})}

export async function toggleProduct(id:string){if(cloudShopping){try{return await saveFavorite(id)}catch(e){showToast((e as Error).message);return false}}store.savedProducts=store.savedProducts.includes(id)?store.savedProducts.filter(x=>x!==id):[...store.savedProducts,id]}
export async function setCartQuantity(id:string,value:number|null){try{if(cloudShopping)return await saveCartQuantity(id,value);if(value===null)delete store.cart[id];else store.cart[id]=Math.min(99,Math.max(1,Math.trunc(value)||1));return true}catch(e){showToast((e as Error).message);return false}}
export async function addToCart(id:string){return setCartQuantity(id,Math.min(99,(store.cart[id]||0)+1))}

export const currentPets=computed(()=>ownedPets(store.pets,store.profile?.id||store.profile?.email))
