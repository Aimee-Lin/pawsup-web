import type { Profile } from '../types'
import { cloudAuth } from './cloudbase'
import { supabase } from './supabase'
const sessionKey = 'pawsup_auth_session_v1'
const accountsKey = 'pawsup_auth_accounts_v1'
const namesKey = 'pawsup_display_names_v1'
function displayNames():Record<string,string>{try{return JSON.parse(localStorage.getItem(namesKey)||'{}')}catch{return {}}}
interface Account { username:string; name:string; salt:string; hash:string }
export function localSession():Profile|null {
  if(supabase || cloudAuth) return null
  try { const value=JSON.parse(sessionStorage.getItem(sessionKey)||'null');return value?.email&&value?.name?value:null } catch { return null }
}
async function hash(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
function accounts():Account[]{try{return JSON.parse(localStorage.getItem(accountsKey)||'[]')}catch{return []}}
export async function localLogin(username:string,password:string):Promise<Profile>{
  let profile:Profile
  if(username==='admin'&&password==='123456') profile={name:'admin',email:'admin'}
  else {const account=accounts().find(a=>a.username===username);if(!account||account.hash!==await hash(account.salt+password)) throw Error('账号或密码错误');profile={name:account.name,email:account.username}}
  profile.name=displayNames()[profile.email]||profile.name
  sessionStorage.setItem(sessionKey,JSON.stringify(profile));return profile
}
export async function localRegister(username:string,password:string,name:string):Promise<void>{
  if(username==='admin'||accounts().some(a=>a.username===username)) throw Error('该账号已存在，请直接登录')
  const salt=crypto.randomUUID();const account={username,name,salt,hash:await hash(salt+password)}
  localStorage.setItem(accountsKey,JSON.stringify([...accounts(),account]))
}
export function clearLocalSession(){sessionStorage.removeItem(sessionKey)}

export function updateLocalProfile(profile:Profile){if(!supabase){localStorage.setItem(namesKey,JSON.stringify({...displayNames(),[profile.email]:profile.name}));sessionStorage.setItem(sessionKey,JSON.stringify(profile))}}
