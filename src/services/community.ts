import type {Post} from '../types'
import assets from '../assets.json'
const img=(key:string)=>(assets as Record<string,string>)[key]||''
export const postKinds=[{id:'chat',label:'养宠交流'},{id:'buddy',label:'找搭子'},{id:'lost',label:'寻宠互助'},{id:'service',label:'宠物服务'}] as const
export function kindOf(p:Post){return p.kind||(p.category==='找搭子'?'buddy':p.category==='寻宠互助'?'lost':'chat')}
export function matchesPost(p:Post,kind:string,query:string){return (kind==='all'||kindOf(p)===kind)&&(p.title+' '+p.content+' '+p.author+' '+(p.location||'')).toLowerCase().includes(query.trim().toLowerCase())}
export function validatePost(data:{title:string;content:string;kind:string;location:string;when:string;price:string}){
 if(!data.title.trim()||!data.content.trim())return '请填写标题和内容'
 if(data.kind!=='chat'&&!data.location.trim())return '请填写活动地点或服务地区'
 if(['buddy','lost','service'].includes(data.kind)&&!data.when.trim())return '请填写活动、走失或服务时间'
 if(data.price&&(!/^\d+(\.\d{1,2})?$/.test(data.price)||Number(data.price)>100000))return '请输入有效金额，最多两位小数且不超过 100000 元'
 return ''
}
const seeds=[
 {id:'offer-walk',title:'傍晚遛狗 · 45 分钟',content:'工作日晚间可陪毛孩子在小区周边散步。请先说明宠物体型、性格和出行习惯，具体安排需双方确认。',serviceRole:'offer',price:'35',author:'小林的遛狗日记',location:'上海 · 徐汇',when:'工作日 18:00–20:00',serviceKind:'代遛',avatar:'pet-buding'},
 {id:'offer-feed',title:'上门喂猫 · 30 分钟',content:'可提供补水、喂食与猫砂清理。此为本地演示服务信息，不含真实人员核验或上门预约。',serviceRole:'offer',price:'40',author:'猫咪邻居',location:'上海 · 静安',when:'周末白天',serviceKind:'上门喂养',avatar:'pet-yunduo'},
 {id:'offer-drive',title:'宠物接送 · 医院 / 美容',content:'接送地点与宠物出行箱要求需事先沟通。此为演示信息，未接入真实接送。',serviceRole:'offer',price:'58',author:'布丁出行',location:'上海 · 长宁',when:'提前一天沟通',serviceKind:'宠物接送',avatar:'pet-mianhua'},
 {id:'find-feed',title:'周末出差 · 上门喂猫 2 次',content:'希望找附近邻居帮助照顾一只布偶猫，需要补水喂食并反馈情况。具体时间与费用待沟通。',serviceRole:'find',price:'60',author:'云朵的家',location:'上海 · 徐汇',when:'周六、周日各一次',serviceKind:'上门喂养',avatar:'pet-yunduo'},
 {id:'find-walk',title:'工作日代遛 · 金毛 1 只',content:'寻找有大型犬照护经验的邻居，傍晚在小区附近遛狗。双方需先沟通宠物习惯。',serviceRole:'find',price:'35',author:'金毛小太阳',location:'上海 · 浦东',when:'工作日傍晚',serviceKind:'代遛',avatar:'pet-buding'},
 {id:'find-stay',title:'临时寄养 2 晚 · 比熊',content:'短途外出寻找临时照护，宠物性格亲人，需提前沟通环境和照护要求。',serviceRole:'find',price:'160',author:'棉花的家',location:'上海 · 长宁',when:'下周末',serviceKind:'寄养',avatar:'pet-mianhua'}
]
export const communitySamples:Post[]=[...seeds.map((p,i)=>({...p,id:'community-'+p.id,serviceRole:p.serviceRole as 'find'|'offer',avatar:img(p.avatar),kind:'service' as const,category:'宠物服务',image:'',likes:0,liked:false,createdAt:Date.now()-i*3600000,comments:[],sample:true})),{id:'community-buddy',author:'和布丁去散步',avatar:img('pet-buding'),title:'周末江边散步，找个毛孩子搭子',content:'想约性格友好的小伙伴一起散步，全程牵绳，保持合适距离，一起记录周末小美好。',kind:'buddy',category:'找搭子',location:'上海 · 徐汇滨江',when:'周末下午，具体时间再商量',image:img('nearby-park'),likes:56,liked:false,createdAt:Date.now()-86400000,comments:[],sample:true},{id:'community-lost',author:'邻里互助站',avatar:img('pet-wuwu'),title:'寻宠示例：灰色猫咪走失，请留意',content:'这是一条界面演示信息，并非真实寻宠事件。正式发布时请注明最后出现位置、时间、明显特征和可靠的联系途径。',kind:'lost',category:'寻宠互助',location:'上海 · 示例小区',when:'走失时间示例',image:img('pet-wuwu'),likes:12,liked:false,createdAt:Date.now()-7200000,comments:[],sample:true}]
