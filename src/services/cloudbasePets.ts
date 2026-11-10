import { cloudApp, cloudbaseTable } from './cloudbase'
import type { RemotePetRow } from './petMapping'

type PetFields = Omit<RemotePetRow, 'id' | 'owner_id' | 'photo_path'> & {
  photo_path?: string
}

function app() {
  if (!cloudApp) throw Error('未配置 CloudBase')
  return cloudApp
}

function pets() {
  return cloudbaseTable('pawsup_pets')
}

function photos() {
  return app().storage.from('pawsup-pet-photos')
}

export const cloudbasePets = {
  async list(owner: string) {
    const rows: RemotePetRow[] = []
    const pageSize = 100
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await pets().select('*').eq('owner_id', owner)
        .order('id').range(offset, offset + pageSize - 1)
      if (error) throw error
      const page = (data ?? []) as RemotePetRow[]
      rows.push(...page)
      if (page.length < pageSize) return rows
    }
  },

  async save(owner: string, fields: PetFields, id?: string) {
    const query = id ? pets().update(fields).eq('id', id).eq('owner_id', owner)
      : pets().insert(fields)
    const { data, error } = await query.select('*').single()
    if (error) throw error
    if (!data) throw Error('未找到你的宠物档案')
    return data as RemotePetRow
  },

  async remove(id: string) {
    const { data, error } = await pets().delete().eq('id', id).select('id').single()
    if (error) throw error
    if (!data) throw Error('未找到你的宠物档案')
  },

  async upload(owner: string, blob: Blob) {
    const path = `${owner}/${crypto.randomUUID()}.jpg`
    const { error } = await photos().upload(path, blob, { contentType: blob.type })
    if (error) throw error
    return path
  },

  async imageUrl(path: string) {
    const { data, error } = await photos().createSignedUrl(path, 300)
    if (error) throw error
    if (!data?.fullSignedURL) throw Error('照片暂时无法读取')
    return data.fullSignedURL
  },

  async removePhoto(path: string) {
    const { error } = await photos().remove([path])
    if (error) throw error
  },
}
