/** Explicit API adapter. Existing demo views are not silently switched to remote data. */
import {supabase} from './supabase'
function client(){if(!supabase)throw Error('尚未配置 Supabase，请先完成服务端初始化');return supabase}
export async function requireRemoteUser(){const {data,error}=await client().auth.getUser();if(error||!data.user)throw Error('请使用 Supabase 账号登录，本地 admin 不能访问服务端');return data.user}
export const backend={
 async health(){await requireRemoteUser();const {data:{session}}=await client().auth.getSession();const response=await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health`,{headers:{Authorization:`Bearer ${session!.access_token}`,apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY}});if(!response.ok)throw Error(`服务端检查失败 (${response.status})`);return response.json()},
 async pets(){await requireRemoteUser();const {data,error}=await client().from('pets').select('*').order('created_at',{ascending:false});if(error)throw error;return data},
 async createPet(input:{name:string;species:'cat'|'dog'|'other';breed?:string;age?:string;bio?:string;photo_path?:string}){const user=await requireRemoteUser();const {data,error}=await client().from('pets').insert({...input,owner_id:user.id}).select().single();if(error)throw error;return data},
 async updatePet(id:string,input:{name?:string;species?:'cat'|'dog'|'other';breed?:string;age?:string;bio?:string;photo_path?:string}){await requireRemoteUser();const {data,error}=await client().from('pets').update(input).eq('id',id).select().single();if(error)throw error;return data},
 async deletePet(id:string){await requireRemoteUser();const {data,error}=await client().from('pets').delete().eq('id',id).select('id');if(error)throw error;if(!data?.length)throw Error('宠物不存在或无权删除')},
 async upload(bucket:'pet-photos'|'post-images'|'avatars',file:File){const user=await requireRemoteUser();if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('请选择 5MB 内的 JPG、PNG 或 WebP 图片');const extension=file.type==='image/jpeg'?'jpg':file.type.split('/')[1];const path=`${user.id}/${crypto.randomUUID()}.${extension}`;const {error}=await client().storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;return path},
 async imageUrl(bucket:'pet-photos'|'post-images'|'avatars',path:string){await requireRemoteUser();const {data,error}=await client().storage.from(bucket).createSignedUrl(path,300);if(error)throw error;return data.signedUrl}
}
