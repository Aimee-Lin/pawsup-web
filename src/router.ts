import {cloudApplications,syncApplications} from './services/remoteApplications'
import {cloudProfiles,syncProfile} from './services/remoteProfile'
import {cloudShopping,syncShopping} from './services/remoteShopping'
import {cloudTrips,syncTrips} from './services/remoteTrips'
import {cloudCommunity,syncCommunity} from './services/remoteCommunity'
import {cloudPetsEnabled,syncRemotePets} from './services/remotePets'
import {showToast} from 'vant'
import { supabase } from './services/supabase'
import { localSession } from './services/auth'
import {showConfirmDialog} from 'vant'
import { store,currentPets } from './stores/community'
import {createRouter,createWebHistory} from 'vue-router'
import Goods from './views/Goods.vue'
import ProductDetail from './views/ProductDetail.vue'
import Outing from './views/Outing.vue'
import Home from './views/Home.vue'
import Community from './views/Community.vue'
import Publish from './views/Publish.vue'
import Pets from './views/Pets.vue'
import Profile from './views/Profile.vue'
import Auth from './views/Auth.vue'
import PostDetail from './views/PostDetail.vue'
import { cloudAuth, cloudSession } from './services/cloudbase'
export const router=createRouter({history:createWebHistory(),routes:[{path:'/assistant',component:()=>import('./views/PetAssistant.vue')},{path:'/travel',component:()=>import('./views/TravelTools.vue')},{path:'/goods',component:Goods},{path:'/goods/:id',component:ProductDetail},{path:'/outing',component:Outing},{path:'/',component:Home},{path:'/community',component:Community},{path:'/publish',component:Publish},{path:'/pets',component:Pets},{path:'/profile',component:Profile},{path:'/auth',component:Auth},{path:'/posts/:id',component:PostDetail}],scrollBehavior:()=>({top:0})})

router.beforeEach(async (to,from)=>{
  if(supabase){
    const {data,error}=await supabase.auth.getSession()
    if(error){store.profile=null;return to.path==='/auth'?true:'/auth'}
    store.profile=data.session?{id:data.session.user.id,name:data.session.user.user_metadata.name||'铲屎官',email:data.session.user.email||''}:null
  }else if(cloudAuth){
    try{
      const session=await cloudSession()
      store.profile=session && store.profile?.id===session.id
        ? {...session,name:store.profile?.name || session.name}
        : session
    }catch{
      store.profile=null
      if(to.path!=='/auth')showToast('登录状态读取失败，请重新登录')
    }
  }else store.profile=localSession()
  if(!store.profile&&to.path!=='/auth') return '/auth'
  if(store.profile&&to.path==='/auth') return '/'
  if(cloudProfiles&&store.profile){
    try{await syncProfile()}catch{if(to.path==='/profile')showToast('个人资料加载失败，请刷新重试')}
  }
  if(cloudPetsEnabled&&store.profile){
    try{await syncRemotePets()}catch{
      if(['/publish','/outing'].includes(to.path)){showToast('宠物档案加载失败，请在管理页重试');return '/pets'}
    }
  }
  if(cloudShopping&&store.profile&&(to.path==='/profile'||to.path.startsWith('/goods'))){try{await syncShopping()}catch{showToast('好物数据加载失败，请在好物页重试')}}
  if(cloudTrips&&store.profile&&['/outing','/profile'].includes(to.path)){try{await syncTrips()}catch{showToast('行程加载失败，请在出行页重试')}}
  if(cloudCommunity&&store.profile&&(!cloudAuth||['/','/community','/profile','/publish'].includes(to.path)||to.path.startsWith('/posts/'))){try{await syncCommunity()}catch{showToast('社区加载失败，请在社区页重试')}}
  if(cloudApplications&&store.profile&&(to.path==='/profile'||to.path==='/community'||to.path.startsWith('/posts/'))){try{await syncApplications()}catch{showToast('服务意向加载失败，请刷新重试')}}
  if(['/publish','/outing'].includes(to.path)&&!currentPets.value.length){
    try{
      await showConfirmDialog({title:'先添加毛孩子吧',message:'请先创建一份属于你的宠物档案，再使用发帖、出行等功能。',confirmButtonText:'去添加宠物',cancelButtonText:'暂时不添加'})
      return {path:'/pets',query:{add:'1',next:to.fullPath}}
    }catch{return from.matched.length?false:'/'}
  }
  return true
})
