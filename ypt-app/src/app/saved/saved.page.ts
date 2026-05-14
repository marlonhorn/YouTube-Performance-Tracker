import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { StorageService, StoredEntry } from '../core/services/storage.service';
import { YoutubeApiService } from '../core/services/youtube-api.service';
import { CsvExportService } from '../core/services/csv-export.service';

@Component({
  selector: 'app-saved',
  templateUrl: 'saved.page.html',
  styleUrls: ['saved.page.scss'],
  standalone: false,
})
export class SavedPage {

  public entries: StoredEntry[]  = [];
  public selectedIds: Set<string> = new Set();
  public refreshingId = '';

  constructor(
    private storageService: StorageService,
    private youtubeApiService: YoutubeApiService,
    private csvExportService: CsvExportService,
    private alertController: AlertController,
    private translateService: TranslateService,
  ) {}

  /** Reload entries each time the page becomes active. */
  async ionViewWillEnter(): Promise<void> {
    await this.loadEntries();
  }

  private async loadEntries(): Promise<void> {
    this.entries = await this.storageService.getAll();
    this.entries.sort((a, b) => b.timestamp - a.timestamp);
    this.selectedIds.clear();
  }

  /** Returns the two entries currently selected for comparison. */
  get comparisonPair(): StoredEntry[] {
    return Array.from(this.selectedIds)
      .map(id => this.entries.find(e => e.id === id))
      .filter((e): e is StoredEntry => !!e);
  }

  public toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else if (this.selectedIds.size < 2) {
      this.selectedIds.add(id);
    }
  }

  public clearSelection(): void {
    this.selectedIds.clear();
  }

  public async onRefresh(entry: StoredEntry): Promise<void> {
    this.refreshingId = entry.id;
    this.youtubeApiService.refreshStats(entry.videoId).subscribe({
      next:  stats => this.applyRefresh(entry, stats.viewCount, stats.likeCount, stats.commentCount),
      error: ()    => { this.refreshingId = ''; },
    });
  }

  private async applyRefresh(
    entry: StoredEntry, newViews: number, newLikes: number, newComments: number,
  ): Promise<void> {
    const updated: StoredEntry = {
      ...entry,
      prevViewCount:    entry.viewCount,
      prevLikeCount:    entry.likeCount,
      prevCommentCount: entry.commentCount,
      viewCount:    newViews,
      likeCount:    newLikes,
      commentCount: newComments,
      refreshedAt:  Date.now(),
    };
    await this.storageService.update(updated);
    await this.loadEntries();
    this.refreshingId = '';
  }

  public onExportCsv(): void {
    const csv = this.csvExportService.generateCsv(this.entries);
    const filename = `ypt-export-${new Date().toISOString().slice(0, 10)}.csv`;
    this.csvExportService.download(csv, filename);
  }

  public async onDelete(id: string): Promise<void> {
    const confirmed = await this.showConfirmDialog('saved.deleteConfirmTitle', 'saved.deleteConfirmMsg');
    if (!confirmed) { return; }
    this.selectedIds.delete(id);
    await this.storageService.remove(id);
    await this.loadEntries();
  }

  public async onDeleteAll(): Promise<void> {
    const confirmed = await this.showConfirmDialog('saved.deleteAllTitle', 'saved.deleteAllMsg');
    if (!confirmed) { return; }
    await this.storageService.clearAll();
    this.entries = [];
  }

  public delta(current: number, prev?: number): number | null {
    return prev != null ? current - prev : null;
  }

  /** Returns the percentage difference of a vs b (e.g. "+25.0%" or "-12.5%"). */
  public percentDiff(a: number, b: number): string {
    if (b === 0) { return a > 0 ? '–' : '0%'; }
    const diff = ((a - b) / b) * 100;
    return (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
  }

  private async showConfirmDialog(titleKey: string, msgKey: string): Promise<boolean> {
    const keys = [titleKey, msgKey, 'saved.cancel', 'saved.confirm'];
    const t = await firstValueFrom(this.translateService.get(keys));
    return new Promise(async resolve => {
      const alert = await this.alertController.create({
        header:  t[titleKey],
        message: t[msgKey],
        buttons: [
          { text: t['saved.cancel'],  role: 'cancel', handler: () => resolve(false) },
          { text: t['saved.confirm'], handler: () => resolve(true) },
        ],
      });
      await alert.present();
    });
  }
}
