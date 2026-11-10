import type {Pet,Trip} from '../types.ts'
export interface RemoteTripRow {id:string;owner_id:string;city:string;departure_at:string;pet_ids:string[];scene_ids:string[];stops:{title:string;note:string}[];checklist:string[];created_at:string;updated_at:string}
export function tripFields(trip:Trip){return {city:trip.city.trim(),departure_at:new Date(`${trip.date}T${trip.time}:00+08:00`).toISOString(),pet_ids:[...trip.petIds],scene_ids:[...trip.sceneIds],stops:trip.stops.map(s=>({...s})),checklist:[...trip.checklist]}}
export function tripFromRow(row:RemoteTripRow,pets:Pet[]):Trip{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(row.departure_at))
 const value=(type:string)=>parts.find(p=>p.type===type)!.value
 return {id:row.id,ownerId:row.owner_id,remote:true,city:row.city,date:`${value('year')}-${value('month')}-${value('day')}`,time:`${value('hour')}:${value('minute')}`,petIds:[...row.pet_ids],petNames:row.pet_ids.map(id=>pets.find(p=>p.id===id&&p.ownerId===row.owner_id)?.name||'宠物档案已删除'),sceneIds:[...row.scene_ids],stops:row.stops.map(s=>({...s})),checklist:[...row.checklist],demoPets:false,createdAt:Date.parse(row.created_at),updatedAt:Date.parse(row.updated_at)}
}
