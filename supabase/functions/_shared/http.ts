export function corsHeaders(request:Request,allowedOrigins:string[]):Headers|null {
 const origin=request.headers.get('Origin')
 if(origin&&!allowedOrigins.includes(origin))return null
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Vary':'Origin','Cache-Control':'no-store','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, OPTIONS'})
 if(origin)headers.set('Access-Control-Allow-Origin',origin)
 return headers
}
export function bearerToken(request:Request):string|null {
 const match=/^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization')||'')
 return match?.[1]||null
}
export interface HealthDependencies {
 origins:string[];
 verify:(token:string)=>Promise<{id:string}|null>;
 databaseReady:(token:string,id:string)=>Promise<boolean>;
}
export async function handleHealth(request:Request,deps:HealthDependencies):Promise<Response>{
 const headers=corsHeaders(request,deps.origins)
 if(!headers)return Response.json({error:'origin_not_allowed'},{status:403})
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers})
 const token=bearerToken(request)
 if(!token)return Response.json({error:'authentication_required'},{status:401,headers})
 try {
  const user=await deps.verify(token)
  if(!user)return Response.json({error:'invalid_session'},{status:401,headers})
  const ready=await deps.databaseReady(token,user.id)
  if(!ready)return Response.json({error:'database_not_ready'},{status:503,headers})
  return Response.json({service:'pawsup',schemaVersion:1,authenticated:true,database:'ready',ai:'not_configured'},{headers})
 }catch{return Response.json({error:'service_unavailable'},{status:503,headers})}
}
