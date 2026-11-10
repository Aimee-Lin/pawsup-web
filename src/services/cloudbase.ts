import type { SupabaseClient } from '@supabase/supabase-js'
import cloudbase from '@cloudbase/js-sdk'
import type { Profile } from '../types'

const env = import.meta.env.VITE_CLOUDBASE_ENV_ID?.trim()

export const cloudApp = env ? cloudbase.init({
  env,
  region: import.meta.env.VITE_CLOUDBASE_REGION || undefined,
  intl: false,
  persistence: 'local',
}) : null

export const cloudAuth = cloudApp?.auth() ?? null

export async function cloudSession(): Promise<Profile | null> {
  if (!cloudAuth) return null
  const { data, error } = await cloudAuth.getSession()
  if (error) throw error
  const user = data?.session?.user
  if (!user?.id) return null
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.nickName || user.user_metadata?.name || '铲屎官',
  }
}

export function cloudbaseTable(name: 'pawsup_pets' | 'pawsup_trips' | 'pawsup_product_favorites' | 'pawsup_cart_items' | 'pawsup_profiles' | 'pawsup_posts' | 'pawsup_comments' | 'pawsup_likes' | 'pawsup_follows' | 'pawsup_service_applications' | 'pawsup_intent_messages') {
  if (!cloudApp) throw Error('未配置 CloudBase')
  // SDK 3.11 exposes rdb() at runtime, but declares it as the legacy SQL client.
  const rdb = cloudApp.rdb as unknown as () => Pick<SupabaseClient, 'from'>
  return rdb.call(cloudApp).from(name)
}

export async function requireCloudbaseUser(expectedId: string | undefined) {
  const user = await cloudSession()
  if (!user?.id || user.id !== expectedId) throw Error('请重新登录后再试')
  return { id: user.id }
}
