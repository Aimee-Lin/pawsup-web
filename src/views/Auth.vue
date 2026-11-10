<script setup lang="ts">
import {validRegistrationPassword} from '../services/passwordPolicy'
import {computed,ref} from 'vue'
import {useRouter} from 'vue-router'
import {showToast} from 'vant'
import {supabase} from '../services/supabase'
import {cloudAuth} from '../services/cloudbase'
import {initializeCloudbaseNickname} from '../services/remoteProfile'
import {localLogin,localRegister} from '../services/auth'
import {store,image} from '../stores/community'
const router=useRouter(),mode=ref('login'),username=ref(''),password=ref(''),confirm=ref(''),name=ref(''),busy=ref(false),error=ref('')
const emailAuth = !!(cloudAuth || supabase)
const code = ref('')
const verifyCode = ref<((token: string) => Promise<void>) | null>(null)
const verificationEmail=ref('')
const resending=ref(false)
const canResend=computed(()=>mode.value==='login'&&!!verificationEmail.value&&verificationEmail.value===username.value.trim())
function switchMode(value:string){
 if(busy.value||resending.value)return
 resetForm(value)
}
function resetForm(value:string){
 mode.value=value
 error.value=''
 verificationEmail.value=''
 verifyCode.value=null
 code.value=''
 password.value=''
 confirm.value=''
}
async function resendVerification(){
 if(!supabase||!canResend.value||!verificationEmail.value||busy.value||resending.value)return
 resending.value=true
 error.value=''
 try{
  const {error:err}=await supabase.auth.resend({type:'signup',email:verificationEmail.value})
  if(err)throw err
  showToast('重发请求已提交，请查看收件箱和垃圾邮件')
 }catch(e){
  error.value=authErrorMessage(e,'resend')
 }finally{resending.value=false}
}
async function submit(){
 if(busy.value||resending.value)return
 error.value=''
 verificationEmail.value=''
 const account=username.value.trim()
 if(mode.value==='register'&&!validRegistrationPassword(password.value)){error.value='注册密码必须恰好为 6 位';return}
 if(mode.value==='register'&&password.value!==confirm.value){error.value='两次密码不一致';return}
 busy.value=true
 try{
  if(cloudAuth){
   if(mode.value==='login'){
    const {error:err}=await cloudAuth.signInWithPassword({email:account,password:password.value})
    if(err)throw err
   }else if(verifyCode.value){
    await verifyCode.value(code.value.trim())
    try{await initializeCloudbaseNickname(name.value)}
    catch{showToast('账号已创建，请在个人中心保存昵称')}
   }else{
    const {data,error:err}=await cloudAuth.signUp({email:account,password:password.value,name:name.value.trim()})
    if(err)throw err
    const verify=data?.verifyOtp
    if(!verify)throw Error('未能发起邮箱验证，请重试')
    verifyCode.value=async token=>{
      const {error:verifyError}=await verify({token})
      if(verifyError)throw verifyError
    }
    showToast('验证码已发送，请查看邮箱')
    return
   }
  }else if(supabase){
   if(mode.value==='register'){
    const {data,error:err}=await supabase.auth.signUp({email:account,password:password.value,options:{data:{name:name.value.trim()}}})
    if(err)throw err
    if(!data.session){showToast('注册请求已提交，请查看验证邮件');resetForm('login');verificationEmail.value=account;return}
   }else{
    const {error:err}=await supabase.auth.signInWithPassword({email:account,password:password.value});if(err)throw err
   }
  }else{
   if(mode.value==='register')await localRegister(account,password.value,name.value.trim())
   store.profile=await localLogin(account,password.value)
  }
  showToast(mode.value==='register'?'注册成功':'登录成功')
  await router.replace('/')
 }catch(e){
  if(mode.value==='login'&&supabase&&isUnconfirmedEmail(e)){
   verificationEmail.value=account
   error.value='邮箱尚未验证，请打开验证邮件中的链接后再登录。'
  }else error.value=authErrorMessage(e,mode.value)
 }finally{busy.value=false}
}
type AuthFailure={message?:string;name?:string;code?:string;status?:number}
function isUnconfirmedEmail(e:unknown){
 const failure=e as AuthFailure|null
 return failure?.code==='email_not_confirmed'||failure?.message?.toLowerCase()==='email not confirmed'
}
function authErrorMessage(e:unknown,action:string){
 const failure=e as AuthFailure|null
 const message=failure?.message||''
 if(failure?.code==='email_address_not_authorized')return '当前邮件服务不允许向此邮箱发送验证邮件，请联系管理员配置发信服务。'
 if(failure?.code==='over_email_send_rate_limit')return '验证邮件发送次数已达上限，请稍后再试。'
 if(failure?.status===429)return '操作太频繁，请稍后再试。'
 if(action==='resend')return '暂时无法重发验证邮件，请稍后再试。'
 if(failure?.name==='AuthRetryableFetchError'||/failed to fetch|networkerror|load failed/i.test(message))return action==='register'?'未能确认注册结果。请检查网络和收件箱，确认是否收到验证邮件后再试。':'暂时无法连接登录服务，请检查网络后重试。'
 return message||'操作失败，请重试'
}
</script>
<template><main class="auth-page"><div class="auth-brand">🐾 PawsUp</div><img class="auth-pets" :src="image('home-hero-full')||image('hero')" alt="欢迎加入 PawsUp"/><h1>{{mode==='login'?'欢迎回来。':'遇见新的小美好。'}}</h1><p class="muted">登录后，和毛孩子一起开启温暖的陪伴。</p><div class="card auth-card"><div class="feed-tabs"><button :class="{selected:mode==='login'}" @click="switchMode('login')">登录</button><button :class="{selected:mode==='register'}" @click="switchMode('register')">注册</button></div><van-form @submit="submit"><van-field v-if="mode==='register'" v-model="name" :readonly="!!verifyCode" label="昵称" placeholder="怎么称呼你" maxlength="24" :rules="[{validator:v=>!!v.trim(),message:'请填写昵称'}]"/><van-field v-model="username" :readonly="!!verifyCode" :label="emailAuth?'邮箱':'账号'" :type="emailAuth?'email':'text'" :placeholder="emailAuth?'you@example.com':'请输入账号'" autocomplete="username" maxlength="64" :rules="[{validator:v=>emailAuth?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v):/^[a-zA-Z0-9_@.\-]{3,64}$/.test(v.trim()),message:emailAuth?'请填写有效邮箱':'请输入 3–64 位字母、数字或 _ @ . -'}]"/><van-field v-model="password" :readonly="!!verifyCode" label="密码" type="password" :placeholder="mode==='register'?'请输入 6 位密码':'请输入密码'" :autocomplete="mode==='register'?'off':'current-password'" :maxlength="mode==='register'?6:undefined" :rules="[{required:true,message:'请填写密码'},{validator:v=>mode!=='register'||validRegistrationPassword(v),message:'注册密码必须恰好为 6 位'}]"/><van-field v-if="mode==='register'" v-model="confirm" :readonly="!!verifyCode" label="确认密码" type="password" placeholder="再次输入 6 位密码" maxlength="6" autocomplete="off" :rules="[{required:true,message:'请确认密码'}]"/><p v-if="mode==='register'" class="password-rule">密码要求：恰好 6 位，区分大小写。</p><van-field v-if="verifyCode" v-model="code" label="验证码" autocomplete="one-time-code" :rules="[{validator:v=>!!v.trim(),message:'请输入邮箱验证码'}]"/><button v-if="verifyCode" type="button" @click="resetForm('register')" :disabled="busy">重新发送或修改邮箱</button><p v-if="error" class="form-error" role="alert">{{error}}</p><van-button block round native-type="submit" :loading="busy" :disabled="resending" color="linear-gradient(120deg,#e97d66,#d8614b)">{{mode==='login'?'登录':verifyCode?'验证并注册':cloudAuth?'发送验证码':'注册并登录'}}</van-button>
<van-button v-if="canResend" class="resend-button" block plain round native-type="button" :loading="resending" :disabled="busy" @click="resendVerification">重新发送验证邮件</van-button>
</van-form></div><p v-if="!emailAuth" class="end-note">测试账号：admin　密码：123456<br>本地测试登录，账号与业务数据尚未接入服务器。</p><p v-else class="end-note">已连接{{cloudAuth?' CloudBase ':' Supabase '}}身份认证，请使用真实邮箱。</p></main></template>

<style scoped>.password-rule{font-size:12px;color:#8b6cc9;margin:12px 0 18px;line-height:1.7}
.resend-button{margin-top:12px}
</style>
