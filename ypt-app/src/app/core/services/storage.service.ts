import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

export interface StoredEntry {
  id: string;
  timestamp: number;
  inputValue: string;
  apiResponse: any;
  userComment?: string;
  hash: string;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly STORAGE_KEY = 'youtube_entries';
  private _storage: Storage | null = null;

  constructor(private storage: Storage) {}

  public async init(): Promise<void> {
    if (this._storage) {
      return;
    }
    this._storage = await this.storage.create();
  }

  public async getAll(): Promise<StoredEntry[]> {
    await this.init();
    const entries = (await this._storage?.get(this.STORAGE_KEY)) || [];
    return entries as StoredEntry[];
  }

  public async save(entry: StoredEntry): Promise<void> {
    await this.init();
    const entries = (await this.getAll()) || [];

    // deduplication by hash
    if (entries.some((e) => e.hash === entry.hash)) {
      throw new Error('duplicate');
    }

    entries.push(entry);
    await this._storage?.set(this.STORAGE_KEY, entries);
  }

  public async remove(id: string): Promise<void> {
    await this.init();
    const entries = (await this.getAll()) || [];
    const filtered = entries.filter((e) => e.id !== id);
    await this._storage?.set(this.STORAGE_KEY, filtered);
  }

  public async clearAll(): Promise<void> {
    await this.init();
    await this._storage?.remove(this.STORAGE_KEY);
  }

  public async count(): Promise<number> {
    const entries = await this.getAll();
    return entries.length;
  }
}
