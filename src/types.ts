export interface Pet { cloudId?:string; photoPath?:string; ownerId?:string; id:string; name:string; species:string; breed:string; age:string; photo:string; bio:string }
export interface Post { remote?:boolean; ownerId?:string; imagePaths?:string[]; id:string; author:string; avatar:string; title:string; content:string; image:string; category:string; likes:number; liked:boolean; createdAt:number; mine?:boolean; kind?:'chat'|'buddy'|'lost'|'service'; serviceRole?:'find'|'offer'; serviceKind?:string; location?:string; when?:string; price?:string; petIds?:string[]; photos?:string[]; sample?:boolean; updatedAt?:number; comments:{id:string;author:string;text:string}[] }
export interface Profile { id?:string; name:string; email:string }

export interface Trip { remote?:boolean; ownerId?:string; id:string; city:string; date:string; time:string; petIds:string[]; petNames:string[]; sceneIds:string[]; stops:{title:string;note:string}[]; checklist:string[]; demoPets:boolean; createdAt:number; updatedAt:number }

export interface ServiceApplication {remote?:boolean;applicantId?:string;applicantName?:string;received?:boolean;id:string;postId:string;title:string;direction:'buyer'|'provider';status:'pending'|'cancelled';createdAt:number}
