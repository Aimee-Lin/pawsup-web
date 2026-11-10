import {createClient} from 'npm:@supabase/supabase-js@2'
import {handleHealth} from '../_shared/http.ts'
const origins=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean)
const url=Deno.env.get('SUPABASE_URL')!
const key=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
const client=(token?:string)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:token?{headers:{Authorization:`Bearer ${token}`}}:undefined})
Deno.serve(request=>handleHealth(request,{
 origins,
 verify:async token=>{const {data,error}=await client().auth.getUser(token);return error?null:data.user},
 databaseReady:async (token,id)=>{const {data,error}=await client(token).from('profiles').select('id').eq('id',id).maybeSingle();return !error&&!!data}
}))
