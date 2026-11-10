/** Minimal Deno runtime surface used by these functions; no Node globals in Edge code. */
declare namespace Deno {
 namespace env { function get(name:string):string|undefined }
 function serve(handler:(request:Request)=>Response|Promise<Response>):unknown
}
