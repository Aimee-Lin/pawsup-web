import type {Post} from '../types.ts'
export interface RemotePostRow {
 id:string;owner_id:string;title:string;content:string;kind:Post['kind'];category:string;
 service_role:Post['serviceRole'];service_kind:string;price:number|null;location:string;when_text:string;
 image_paths:string[];created_at:string;updated_at:string;
 post_pets:{pet_id:string}[];likes:{owner_id:string}[];
 comments:{id:string;owner_id:string;content:string;created_at:string}[]
}
export function postFromRow(row:RemotePostRow,userId:string,names:Map<string,string>,photos:string[],avatar:string):Post {
 return {id:row.id,remote:true,ownerId:row.owner_id,imagePaths:[...row.image_paths],author:names.get(row.owner_id)||'铲屎官',avatar,title:row.title,content:row.content,kind:row.kind,category:row.category,serviceRole:row.service_role,serviceKind:row.service_kind,price:row.price==null?'':String(row.price),location:row.location,when:row.when_text,petIds:row.post_pets.map(p=>p.pet_id),photos,image:photos[0]||'',createdAt:Date.parse(row.created_at),updatedAt:Date.parse(row.updated_at),mine:row.owner_id===userId,likes:row.likes.length,liked:row.likes.some(l=>l.owner_id===userId),comments:[...row.comments].sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(c=>({id:c.id,author:names.get(c.owner_id)||'铲屎官',text:c.content}))}
}
