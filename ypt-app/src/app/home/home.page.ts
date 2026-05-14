import { Component } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { StorageService, StoredEntry } from '../core/services/storage.service';
import { YoutubeApiService, VideoStats, YOUTUBE_CATEGORIES } from '../core/services/youtube-api.service';
import { v4 as uuidv4 } from 'uuid';

/** Possible sort criteria for the video results list. */
export type SortKey =
  'views' | 'likes' | 'comments' |
  'likesComments' | 'likesViews' |
  'engagementRate' | 'commentRate' | 'viewsPerDay' | 'newest';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {

  /** Current free-text search query entered by the user. */
  public query            = '';
  /** Selected YouTube category ID (empty string = all categories). */
  public selectedCategory = '';
  public isLoading        = false;
  public hasSearched      = false;
  public results: VideoStats[]       = [];
  public sortedResults: VideoStats[] = [];
  public activeSortKey: SortKey      = 'views';
  /** Current sort direction; toggled by clicking the active sort chip again. */
  public sortDirection: 'asc' | 'desc' = 'desc';
  public nextPageToken    = '';
  /** Video IDs that the user has already saved, used to show the filled icon. */
  public savedVideoIds    = new Set<string>();

  public readonly categories = YOUTUBE_CATEGORIES;

  public readonly sortOptions: { key: SortKey; labelKey: string }[] = [
    { key: 'views',          labelKey: 'home.sortViews' },
    { key: 'likes',          labelKey: 'home.sortLikes' },
    { key: 'comments',       labelKey: 'home.sortComments' },
    { key: 'likesComments',  labelKey: 'home.sortLikesComments' },
    { key: 'likesViews',     labelKey: 'home.sortLikesViews' },
    { key: 'engagementRate', labelKey: 'home.sortEngagement' },
    { key: 'commentRate',    labelKey: 'home.sortCommentRate' },
    { key: 'viewsPerDay',    labelKey: 'home.sortViewsPerDay' },
    { key: 'newest',         labelKey: 'home.sortNewest' },
  ];

  constructor(
    private youtubeApiService: YoutubeApiService,
    private alertController: AlertController,
    private translateService: TranslateService,
    private storageService: StorageService,
  ) {}

  /** Refresh the set of saved video IDs each time the page becomes visible. */
  async ionViewWillEnter(): Promise<void> {
    const entries = await this.storageService.getAll();
    this.savedVideoIds = new Set(entries.map(e => e.videoId));
  }

  /** True when at least a text query or a category is selected. */
  public get canSearch(): boolean {
    return !!this.query.trim() || !!this.selectedCategory;
  }

  /** Start a fresh search from page 1. */
  public onSearch(): void {
    if (!this.canSearch) { return; }
    this.hasSearched   = true;
    this.isLoading     = true;
    this.results       = [];
    this.sortedResults = [];
    this.nextPageToken = '';
    this.executeSearch();
  }

  /** Re-trigger search when the category filter changes. */
  public onFilterChange(): void {
    if (this.canSearch) { this.onSearch(); }
  }

  /** Append the next page of results to the existing list. */
  public onLoadMore(): void {
    if (!this.nextPageToken || this.isLoading) { return; }
    this.isLoading = true;
    this.executeSearch(this.nextPageToken);
  }

  private executeSearch(pageToken = ''): void {
    this.youtubeApiService.search({
      query:      this.query.trim(),
      categoryId: this.selectedCategory,
      pageToken,
    }).subscribe({
      next: res => {
        this.isLoading     = false;
        this.results       = [...this.results, ...res.videos];
        this.nextPageToken = res.nextPageToken ?? '';
        this.applySorting();
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.showTranslatedError(err.status === 0 ? 'errors.network' : 'errors.api');
      },
    });
  }

  /**
   * Set the active sort key. If the same key is clicked again,
   * the sort direction toggles between descending and ascending.
   */
  public setSortKey(key: SortKey): void {
    if (this.activeSortKey === key) {
      this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      this.activeSortKey = key;
      this.sortDirection = 'desc';
    }
    this.applySorting();
  }

  private applySorting(): void {
    const comparators: Record<SortKey, (a: VideoStats, b: VideoStats) => number> = {
      views:          (a, b) => b.viewCount - a.viewCount,
      likes:          (a, b) => b.likeCount - a.likeCount,
      comments:       (a, b) => b.commentCount - a.commentCount,
      likesComments:  (a, b) => this.ratio(b.likeCount, b.commentCount) - this.ratio(a.likeCount, a.commentCount),
      likesViews:     (a, b) => this.ratio(b.likeCount, b.viewCount) - this.ratio(a.likeCount, a.viewCount),
      engagementRate: (a, b) => this.engagementRate(b) - this.engagementRate(a),
      commentRate:    (a, b) => this.ratio(b.commentCount, b.viewCount) - this.ratio(a.commentCount, a.viewCount),
      viewsPerDay:    (a, b) => this.viewsPerDay(b) - this.viewsPerDay(a),
      newest:         (a, b) => new Date(b.publishedAtRaw).getTime() - new Date(a.publishedAtRaw).getTime(),
    };
    const sorted = [...this.results].sort(comparators[this.activeSortKey]);
    this.sortedResults = this.sortDirection === 'asc' ? sorted.reverse() : sorted;
  }

  /** Returns numerator / denominator, or 0 if denominator is zero. */
  public ratio(numerator: number, denominator: number): number {
    return denominator > 0 ? numerator / denominator : 0;
  }

  private engagementRate(v: VideoStats): number {
    return this.ratio(v.likeCount + v.commentCount, v.viewCount);
  }

  private viewsPerDay(v: VideoStats): number {
    const days = (Date.now() - new Date(v.publishedAtRaw).getTime()) / 86_400_000;
    return this.ratio(v.viewCount, Math.max(days, 1));
  }

  /** Open a dialog to let the user add a note and tags before saving. */
  public async onSaveVideo(video: VideoStats): Promise<void> {
    const t = await firstValueFrom(this.translateService.get([
      'home.savePromptTitle', 'home.savePromptPlaceholder',
      'home.tagsPlaceholder', 'home.saveButton', 'home.cancel',
    ]));
    const alert = await this.alertController.create({
      header: t['home.savePromptTitle'],
      inputs: [
        { name: 'note', type: 'text', placeholder: t['home.savePromptPlaceholder'] },
        { name: 'tags', type: 'text', placeholder: t['home.tagsPlaceholder'] },
      ],
      buttons: [
        { text: t['home.cancel'], role: 'cancel' },
        { text: t['home.saveButton'], handler: data => this.persistEntry(video, data.note ?? '', data.tags ?? '') },
      ],
    });
    await alert.present();
  }

  private async persistEntry(video: VideoStats, note: string, rawTags: string): Promise<void> {
    const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
    const raw  = `${video.videoId}|${video.viewCount}|${video.likeCount}|${video.commentCount}`;
    const hash = btoa(encodeURIComponent(raw));
    const entry: StoredEntry = {
      id: uuidv4(), timestamp: Date.now(),
      videoId: video.videoId, title: video.title, channelTitle: video.channelTitle,
      publishedAt: video.publishedAt, thumbnailUrl: video.thumbnailUrl,
      viewCount: video.viewCount, likeCount: video.likeCount, commentCount: video.commentCount,
      userNote: note, tags, hash,
    };
    try {
      await this.storageService.save(entry);
      this.savedVideoIds.add(video.videoId);
      const dialog = await this.alertController.create({
        header: this.translateService.instant('home.saved'), buttons: ['OK'],
      });
      await dialog.present();
    } catch (err) {
      this.showTranslatedError((err as Error).message === 'duplicate' ? 'errors.duplicate' : 'errors.api');
    }
  }

  private showTranslatedError(errorKey: string): void {
    this.translateService.get(['errors.title', errorKey]).subscribe((t: Record<string, string>) => {
      this.alertController.create({ header: t['errors.title'], message: t[errorKey], buttons: ['OK'] })
        .then(a => a.present());
    });
  }
}
