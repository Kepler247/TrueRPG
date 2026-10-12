import { inject, Injectable } from '@angular/core';
import { SUPABASE } from '../auth/supabase';
import { createEntryId } from '../characters/character-core';
export interface ImageChange {
  path: string | null;
  updated_at: string;
}
@Injectable({ providedIn: 'root' })
export class ImageService {
  private readonly client = inject(SUPABASE);
  async url(path: string): Promise<string> {
    const { data, error } = await this.client.storage.from('rpg-images').createSignedUrl(path, 600);
    if (error || !data) throw new Error('Could not load the image.');
    return data.signedUrl;
  }
  async upload(
    kind: 'profiles' | 'characters',
    id: string,
    file: File,
    oldPath: string | null,
    stamp?: string,
  ): Promise<ImageChange> {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensions[file.type];
    if (!extension || file.size > 5 * 1024 * 1024 || file.size === 0)
      throw new Error('Choose a JPEG, PNG, or WebP image up to 5 MB.');
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const valid =
      extension === 'jpg'
        ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
        : extension === 'png'
          ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)
          : String.fromCharCode(...header.slice(0, 4)) === 'RIFF' &&
            String.fromCharCode(...header.slice(8, 12)) === 'WEBP';
    if (!valid) throw new Error('The file does not match its image format.');
    const path = `${kind}/${id}/${createEntryId()}.${extension}`;
    const { error } = await this.client.storage
      .from('rpg-images')
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '600' });
    if (error) throw new Error('Image upload failed. Please retry.');
    let saved: ImageChange;
    try {
      saved = await this.link(kind, id, path, stamp);
    } catch (error) {
      await this.client.storage
        .from('rpg-images')
        .remove([path])
        .catch(() => undefined);
      throw error;
    }
    if (oldPath)
      await this.client.storage
        .from('rpg-images')
        .remove([oldPath])
        .catch(() => undefined);
    return saved;
  }
  private async link(
    kind: 'profiles' | 'characters',
    id: string,
    path: string | null,
    stamp?: string,
  ): Promise<ImageChange> {
    const column = kind === 'profiles' ? 'avatar_path' : 'portrait_path';
    let query = this.client
      .from(kind)
      .update({ [column]: path })
      .eq('id', id);
    if (stamp) query = query.eq('updated_at', stamp);
    const { data, error } = await query.select(`${column},updated_at`).maybeSingle();
    if (error || !data)
      throw new Error('The image could not be attached, or the record changed. Reload and retry.');
    const fields = data as Record<string, unknown>;
    return { path: fields[column] as string | null, updated_at: fields['updated_at'] as string };
  }
  async remove(
    kind: 'profiles' | 'characters',
    id: string,
    path: string,
    stamp?: string,
  ): Promise<ImageChange> {
    const saved = await this.link(kind, id, null, stamp);
    await this.client.storage
      .from('rpg-images')
      .remove([path])
      .catch(() => undefined);
    return saved;
  }
}
