import type {Pet} from '../types'
export function ownedPets(pets:Pet[],account:string|null|undefined):Pet[]{return account?pets.filter(p=>p.ownerId===account):[]}
