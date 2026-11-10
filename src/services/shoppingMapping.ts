export function shoppingFromRows(favorites:{product_id:string}[],cart:{product_id:string;quantity:number}[]){
 return {savedProducts:[...new Set(favorites.map(row=>row.product_id))],cart:Object.fromEntries(cart.filter(row=>Number.isInteger(row.quantity)&&row.quantity>=1&&row.quantity<=99).map(row=>[row.product_id,row.quantity])) as Record<string,number>}
}
export function shoppingQuantity(value:number){if(!Number.isFinite(value))throw Error('请输入 1 到 99 的整数');return Math.min(99,Math.max(1,Math.trunc(value)))}
