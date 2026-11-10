import {postFromRow} from './postMapping'
import {reactive} from 'vue'
import {supabase} from './supabase'
import {cloudApp,cloudbaseTable,requireCloudbaseUser} from './cloudbase'
import {backend,requireRemoteUser} from './backend'
import {store,image} from '../stores/community'
import type {Post} from '../types'
export const communityState=reactive({loading:false,followers:null as number|null,error:'',authors:{} as Record<string,string>})
export const cloudCommunity=!!(cloudApp||supabase)
const postBucket='pawsup-post-images'
function table(name:'posts'|'comments'|'likes'|'follows'){
 return cloudApp?cloudbaseTable(`pawsup_${name}`):supabase!.from(name)
}
async function communityUser(){
 return cloudApp?requireCloudbaseUser(store.profile?.id):requireRemoteUser()
}
async function postImage(path:string){
 if(!cloudApp)return backend.imageUrl('post-images',path)
 const {data,error}=await cloudApp.storage.from(postBucket).createSignedUrl(path,300)
 if(error||!data?.fullSignedURL)throw Error('帖子图片暂时无法读取')
 return data.fullSignedURL
}
async function uploadPostImage(owner:string,blob:Blob){
 if(!cloudApp)return backend.upload('post-images',new File([blob],'post.jpg',{type:blob.type}))
 const path=`${owner}/${crypto.randomUUID()}.jpg`
 const {error}=await cloudApp.storage.from(postBucket).upload(path,blob,{contentType:blob.type})
 if(error)throw error
 return path
}
async function removePostImages(paths:string[]){
 if(cloudApp&&paths.length)await cloudApp.storage.from(postBucket).remove(paths).catch(()=>{})
}
let owner='',pending:Promise<void>|undefined
function checked<T>(result:{data:T;error:unknown}):T{if(result.error)throw result.error;return result.data}
export async function syncCommunity(){
 if(!cloudCommunity||!store.profile?.id)return
 if(pending){await pending;if(owner===store.profile?.id)return;return syncCommunity()}
 const userId=store.profile.id
 if(owner!==userId){if(store.posts.some(p=>!p.remote)){try{if(!localStorage.getItem('pawsup_legacy_posts_backup_v1'))localStorage.setItem('pawsup_legacy_posts_backup_v1',JSON.stringify(store.posts.filter(p=>!p.remote)))}catch{throw Error('本机旧帖子备份失败，请先释放浏览器存储空间')}}store.posts=[];store.following=[];communityState.followers=null;owner=userId}
 communityState.loading=true;communityState.error=''
 pending=(async()=>{try{
 const selection=cloudApp
  ?'*,comments:pawsup_comments(id,owner_id,author_name,content,created_at),likes:pawsup_likes(owner_id)'
  :'*,comments(id,owner_id,content,created_at),likes(owner_id),post_pets(pet_id)'
 const rows: Array<import('./postMapping').RemotePostRow & {author_name?:string;comments:Array<{id:string;owner_id:string;content:string;created_at:string;author_name?:string}>}>=[]
 for(let offset=0;;offset+=100){
  const page=checked(await table('posts').select(selection).eq('status','published')
   .order('created_at',{ascending:false}).order('id').range(offset,offset+99))||[]
  rows.push(...page as unknown as typeof rows)
  if(page.length<100)break
 }
 const following=checked(await table('follows').select('following_id').eq('follower_id',userId))||[]
 const ids=[...new Set(rows.flatMap(r=>[r.owner_id,...r.comments.map((c:{owner_id:string})=>c.owner_id)]).concat(following.map(f=>f.following_id)))]
 const profiles=!cloudApp&&ids.length?checked(await supabase!.from('profiles').select('id,display_name,avatar_path').in('id',ids)):[]
 const avatars=new Map(await Promise.all((profiles||[]).map(async p=>[p.id,p.avatar_path?await backend.imageUrl('avatars',p.avatar_path).catch(()=>image('pet-yunduo')):image('pet-yunduo')] as const)))
 const names=new Map((profiles||[]).map(p=>[p.id,p.display_name]))
 if(cloudApp){
  for(const row of [...rows].reverse()){
   for(const comment of row.comments)if(comment.author_name)names.set(comment.owner_id,comment.author_name)
   if(row.author_name)names.set(row.owner_id,row.author_name)
  }
 }
 const posts:Post[]=await Promise.all(rows.map(async r=>{const photos=await Promise.all((r.image_paths as string[]).map(path=>postImage(path).catch(()=>'')));return postFromRow({...r,post_pets:r.post_pets||[]},userId,names,photos,avatars.get(r.owner_id)||image('pet-yunduo'))}))
 if(store.profile?.id===userId){communityState.authors=Object.fromEntries(names);store.posts=posts;store.following=following.map(f=>f.following_id)}
 }catch(e){communityState.error=(e as Error).message||'社区加载失败';throw e}finally{communityState.loading=false;pending=undefined}})()
 return pending
}
export async function syncFollowerCount(){
 const userId=store.profile?.id
 if(!cloudCommunity||!userId)return
 communityState.followers=null
 const {count,error}=await table('follows').select('follower_id',{count:'exact',head:true}).eq('following_id',userId)
 if(error)throw error
 if(store.profile?.id===userId)communityState.followers=count??0
}
export async function saveCloudPost(post:Post,old?:Post){
 const user=await communityUser();const paths:string[]=[]
 for(const src of post.photos||[]){const index=old?.photos?.indexOf(src)??-1;if(index>=0&&old?.imagePaths?.[index]){paths.push(old.imagePaths[index]!);continue}if(!src.startsWith('data:image/'))throw Error('请移除失效图片并重新选择');const blob=await(await fetch(src)).blob();paths.push(await uploadPostImage(user.id,blob))}
 const fields={kind:post.kind,title:post.title,content:post.content,category:post.category,service_role:post.serviceRole||null,service_kind:post.serviceKind||null,price:post.price?Number(post.price):null,location:post.location||'',when_text:post.when||'',image_paths:paths}
 if(store.profile?.id!==user.id)throw Error('登录账号已切换，请重试')
 const insertFields={...fields,...(cloudApp?{}:{owner_id:user.id})}
 const row=checked(await (old?.remote?table('posts').update(fields).eq('id',old.id).eq('owner_id',user.id):table('posts').insert(insertFields)).select('id').single())
 // Pet selection remains private; publish the text and photos only in this phase.
 if(!row)throw Error('保存未返回帖子，请刷新社区确认')
 await removePostImages((old?.imagePaths||[]).filter(path=>!paths.includes(path)))
 return row.id as string
}
export async function deleteCloudPost(post:Post){const user=await communityUser();const rows=checked(await table('posts').delete().eq('id',post.id).eq('owner_id',user.id).select('id'));if(!rows?.length)throw Error('帖子不存在或无权删除');if(store.profile?.id===user.id)store.posts=store.posts.filter(p=>p.id!==post.id);await removePostImages(post.imagePaths||[])}
export async function cloudLike(post:Post){const user=await communityUser();checked(await(post.liked?table('likes').delete().eq('post_id',post.id).eq('owner_id',user.id):table('likes').insert({post_id:post.id,...(cloudApp?{}:{owner_id:user.id})})));post.liked=!post.liked;post.likes+=post.liked?1:-1}
export async function cloudComment(post:Post,text:string){const user=await communityUser();const row=checked(await table('comments').insert({post_id:post.id,content:text,...(cloudApp?{}:{owner_id:user.id})}).select('id').single());if(!row)throw Error('评论保存失败');post.comments.push({id:row.id,author:store.profile!.name,text})}
export async function cloudFollow(post:Post){const user=await communityUser();if(!post.ownerId||post.ownerId===user.id)return;const exists=store.following.includes(post.ownerId);checked(await(exists?table('follows').delete().eq('follower_id',user.id).eq('following_id',post.ownerId):table('follows').insert({following_id:post.ownerId,...(cloudApp?{}:{follower_id:user.id})})));if(store.profile?.id===user.id)store.following=exists?store.following.filter(id=>id!==post.ownerId):[...store.following,post.ownerId]}

export async function cloudUnfollow(id:string){const user=await communityUser();checked(await table('follows').delete().eq('follower_id',user.id).eq('following_id',id));if(store.profile?.id===user.id)store.following=store.following.filter(value=>value!==id)}
