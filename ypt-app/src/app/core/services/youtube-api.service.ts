import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface VideoStats {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  /** ISO-8601 date string, used for date-based sorting. */
  publishedAtRaw: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface SearchOptions {
  query: string;
  categoryId?: string;
  order?: string;
  pageToken?: string;
  maxResults?: number;
}

export interface SearchResult {
  videos: VideoStats[];
  nextPageToken?: string;
}

export interface RefreshedStats {
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

/** Predefined YouTube video category filter options. */
export const YOUTUBE_CATEGORIES: { id: string; labelKey: string }[] = [
  { id: '',   labelKey: 'search.catAll' },
  { id: '10', labelKey: 'search.catMusic' },
  { id: '17', labelKey: 'search.catSports' },
  { id: '20', labelKey: 'search.catGaming' },
  { id: '22', labelKey: 'search.catPeople' },
  { id: '23', labelKey: 'search.catComedy' },
  { id: '24', labelKey: 'search.catEntertainment' },
  { id: '25', labelKey: 'search.catNews' },
  { id: '27', labelKey: 'search.catEducation' },
  { id: '28', labelKey: 'search.catTech' },
];


interface RawSearchItem {
  id: { videoId: string };
}

interface RawSearchResponse {
  nextPageToken?: string;
  items: RawSearchItem[];
}

interface RawVideoItem {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { medium: { url: string } };
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface RawVideosResponse {
  items: RawVideoItem[];
}

@Injectable({ providedIn: 'root' })
export class YoutubeApiService {

  private readonly BASE = 'https://www.googleapis.com/youtube/v3';

  constructor(private http: HttpClient) {}

  /** Search for videos and fetch their full statistics in one pipeline. */
  public search(options: SearchOptions): Observable<SearchResult> {
    return this.http.get<RawSearchResponse>(this.buildSearchUrl(options)).pipe(
      switchMap(searchRes => {
        const ids = (searchRes.items ?? []).map(i => i.id.videoId).filter(Boolean);
        const nextPageToken = searchRes.nextPageToken;
        return this.fetchVideoDetails(ids).pipe(
          map(videos => ({ videos, nextPageToken })),
        );
      }),
    );
  }

  /** Fetch only the current statistics for a single video (for refresh). */
  public refreshStats(videoId: string): Observable<RefreshedStats> {
    const key = encodeURIComponent(environment.youtubeApiKey);
    const url = `${this.BASE}/videos?part=statistics&id=${encodeURIComponent(videoId)}&key=${key}`;
    return this.http.get<RawVideosResponse>(url).pipe(
      map(res => {
        const stats = res.items?.[0]?.statistics ?? {};
        return {
          viewCount:    this.parseNum(stats.viewCount),
          likeCount:    this.parseNum(stats.likeCount),
          commentCount: this.parseNum(stats.commentCount),
        };
      }),
    );
  }

  private fetchVideoDetails(ids: string[]): Observable<VideoStats[]> {
    const key = encodeURIComponent(environment.youtubeApiKey);
    const url = `${this.BASE}/videos?part=snippet,statistics&id=${encodeURIComponent(ids.join(','))}&key=${key}`;
    return this.http.get<RawVideosResponse>(url).pipe(
      map(res => (res.items ?? []).map(item => ({
        videoId:        item.id,
        title:          item.snippet.title,
        channelTitle:   item.snippet.channelTitle,
        publishedAt:    new Date(item.snippet.publishedAt).toLocaleDateString(),
        publishedAtRaw: item.snippet.publishedAt,
        thumbnailUrl:   item.snippet.thumbnails?.medium?.url ?? '',
        viewCount:      this.parseNum(item.statistics.viewCount),
        likeCount:      this.parseNum(item.statistics.likeCount),
        commentCount:   this.parseNum(item.statistics.commentCount),
      }))),
    );
  }

  private buildSearchUrl(options: SearchOptions): string {
    const params = new URLSearchParams({
      part:       'snippet',
      q:          options.query,
      type:       'video',
      maxResults: String(options.maxResults ?? 50),
      order:      options.order ?? 'relevance',
      key:        environment.youtubeApiKey,
    });
    if (options.categoryId) { params.set('videoCategoryId', options.categoryId); }
    if (options.pageToken)   { params.set('pageToken', options.pageToken); }
    return `${this.BASE}/search?${params.toString()}`;
  }

  private parseNum(val?: string): number {
    const n = Number.parseInt(val ?? '0', 10);
    return Number.isNaN(n) ? 0 : n;
  }
}
