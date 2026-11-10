import type {Pet} from '../types'
export interface RemotePetRow {id:string;owner_id:string;name:string;species:string;breed:string;age:string;bio:string;photo_path:string|null}
export function petFields(form:{name:string;species:string;breed:string;age:string;bio:string}){
 if(!form.name.trim())throw Error('请填写宠物名字')
 return {name:form.name.trim(),species:(form.species==='猫'?'cat':form.species==='狗'?'dog':'other') as 'cat'|'dog'|'other',breed:form.breed,age:form.age,bio:form.bio}
}
export async function petFromRow(row:RemotePetRow,fallback:string,sign:(path:string)=>Promise<string>):Promise<Pet>{
 let photo=fallback
 if(row.photo_path){try{photo=await sign(row.photo_path)}catch{/* The private image may be unavailable; never expose an unsigned URL. */}}
 return {id:row.id,ownerId:row.owner_id,name:row.name,species:row.species==='cat'?'猫':row.species==='dog'?'狗':'其他',breed:row.breed,age:row.age,bio:row.bio,photo,photoPath:row.photo_path||undefined}
}
