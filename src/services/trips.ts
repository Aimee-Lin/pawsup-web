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
