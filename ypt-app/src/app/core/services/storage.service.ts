import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

/** One tracked YouTube video entry saved by the user. */
export interface StoredEntry {
  id: string;
  timestamp: number;
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  userNote: string;
  tags: string[];
  hash: string;
  /** Stats from before the last refresh, for delta display. */
  prevViewCount?: number;
  prevLikeCount?: number;
  prevCommentCount?: number;
  refreshedAt?: number;
}

@Injectable({ providedIn: 'root' })
export class StorageService {

  private readonly STORAGE_KEY = 'ypt_entries';
  private store: Storage | null = null;

  constructor(private storage: Storage) {}

  public async init(): Promise<void> {
    if (this.store) { return; }
    this.store = await this.storage.create();
  }

  public async getAll(): Promise<StoredEntry[]> {
    await this.init();
    return ((await this.store?.get(this.STORAGE_KEY)) ?? []) as StoredEntry[];
  }

  /** @throws Error('duplicate') if an entry with the same hash already exists. */
  public async save(entry: StoredEntry): Promise<void> {
    await this.init();
    const entries = await this.getAll();
    if (entries.some(e => e.hash === entry.hash)) { throw new Error('duplicate'); }
    entries.push(entry);
    await this.store?.set(this.STORAGE_KEY, entries);
  }

  /** Replace an existing entry by id (used for stats refresh). */
  public async update(entry: StoredEntry): Promise<void> {
    await this.init();
    const entries = await this.getAll();
    const idx = entries.findIndex(e => e.id === entry.id);
    if (idx === -1) { return; }
    entries[idx] = entry;
    await this.store?.set(this.STORAGE_KEY, entries);
  }

  public async remove(id: string): Promise<void> {
    await this.init();
    const entries = await this.getAll();
    await this.store?.set(this.STORAGE_KEY, entries.filter(e => e.id !== id));
  }

  public async clearAll(): Promise<void> {
    await this.init();
    await this.store?.remove(this.STORAGE_KEY);
  }
}
