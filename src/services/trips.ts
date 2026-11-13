export const scenes=[
 {id:'park',name:'公园',note:'草地撒欢',stop:'宠物友好公园',color:'#ddf3e4'},
 {id:'cafe',name:'宠物咖啡',note:'带宠入座',stop:'宠物咖啡馆',color:'#fff3c9'},
 {id:'camp',name:'露营',note:'星空草地',stop:'宠物露营营地',color:'#ffe5d4'},
 {id:'beach',name:'海滩',note:'踏浪奔跑',stop:'海边休闲点',color:'#dcebff'},
 {id:'playground',name:'宠物乐园',note:'放电玩耍',stop:'宠物活动场',color:'#ffe3ec'},
 {id:'hiking',name:'徒步',note:'山野清风',stop:'户外徒步路线',color:'#ebf2d5'},
 {id:'inn',name:'民宿',note:'安心过夜',stop:'宠物友好民宿',color:'#ebe3ff'},
 {id:'diner',name:'宠物餐厅',note:'一起用餐',stop:'宠物友好餐厅',color:'#f3e0fa'},
 {id:'grooming',name:'美容洗护',note:'焕然一新',stop:'宠物洗护中心',color:'#dff5ee'}
]
export function todayInShanghai(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function makeStops(ids:string[]){return [...new Set(ids)].map(id=>scenes.find(s=>s.id===id)).filter((s):s is typeof scenes[number]=>!!s).map(s=>({title:s.stop,note:'示例场景 · 请自行确认真实地点与携宠规则'}))}
export function validateTrip(pets:string[],ids:string[],date:string,time:string,now=new Date()):string{
 if(!pets.length)return '请至少选择一只同行宠物'
 if(!makeStops(ids).length)return '请至少选择一个活动场景'
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00+08:00'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)return '请选择有效出行日期'
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return '请选择有效出发时间'
 if(new Date(date+'T'+time+':00+08:00').getTime()<=now.getTime())return '出发时间应晚于当前时间'
 return ''
}

export const outingCities = [
 '上海','北京','广州','深圳','杭州','南京','苏州','宁波','合肥','福州','厦门','济南','青岛',
 '天津','石家庄','太原','郑州','武汉','长沙','南昌','成都','重庆','西安','昆明','贵阳','南宁',
 '海口','三亚','沈阳','大连','长春','哈尔滨','呼和浩特','兰州','西宁','银川','乌鲁木齐','拉萨',
]

const sceneMinutes: Record<string, number> = {
 park:45,cafe:45,camp:120,beach:45,playground:60,hiking:90,inn:0,diner:60,grooming:60,
}

export function recommendOuting(ids:string[], departure:string, petCount:number, condition?:string){
 const selected = [...new Set(ids)]
  .map(id=>scenes.find(scene=>scene.id===id))
  .filter((scene):scene is typeof scenes[number]=>!!scene)
 const ordered = [...selected.filter(scene=>scene.id!=='inn'),...selected.filter(scene=>scene.id==='inn')]
 const roughWeather = /雨|雪|雷|冰雹|大风/.test(condition||'')
 const needsCar = roughWeather || petCount>1 || ordered.some(scene=>['camp','beach','hiking','inn'].includes(scene.id))
 const [hours, minutes] = departure.split(':').map(Number)
 const departureMinutes = hours*60+minutes
 let elapsed = 0
 const stops = ordered.map(scene=>{
  const duration = sceneMinutes[scene.id]
  const start = departureMinutes + elapsed
  const clock = Number.isFinite(start)
   ? `${start>=1440?'次日 ':''}${String(Math.floor(start/60)%24).padStart(2,'0')}:${String(start%60).padStart(2,'0')}`
   : ''
  elapsed += duration
  const outdoor = ['park','camp','beach','playground','hiking'].includes(scene.id)
  const note = duration ? `建议停留 ${duration} 分钟` : '办理入住，安顿宠物'
  return {title:scene.stop,note:`${clock ? '约 '+clock+' · ' : ''}${note}${roughWeather&&outdoor?' · 遇到雨雪或大风可缩短停留，必要时取消户外活动':''}`}
 })
 return {
  transport: needsCar ? '优先考虑自驾或预约可携宠的车辆' : '邻近场景可步行，距离较远可预约可携宠的车辆',
  reason: roughWeather ? '当前实况有降水或大风，出发前再确认天气与路况。'
   : petCount>1 ? '多只宠物同行时，提前确认车辆空间和固定方式。'
   : '提前确认车辆或场所的携宠规则，并准备牵引绳或航空箱。',
  stops,
 }
}
