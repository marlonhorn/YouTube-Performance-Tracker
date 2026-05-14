import { Component } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { environment } from 'src/environments/environment';

interface YoutubeVideoItem {
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
  };
  statistics: {
    viewCount: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface YoutubeVideosResponse {
  items: YoutubeVideoItem[];
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  public videoId = '';
  public isLoading = false;
  public videoTitle = '';
  public channelTitle = '';
  public publishedAt = '';
  public viewCount = 0;
  public likeCount = 0;
  public commentCount = 0;
  public lastFetchDate: Date | null = null;

  constructor(
    private httpClient: HttpClient,
    private alertController: AlertController,
    private translateService: TranslateService,
  ) {}

  public onLoadVideoDataButton(): void {
    if (!this.isVideoIdValid()) {
      this.showTranslatedError('errors.invalidVideoId');
      return;
    }

    if (environment.youtubeApiKey.trim().length === 0) {
      this.showTranslatedError('errors.missingApiKey');
      return;
    }

    this.isLoading = true;
    const requestUrl = this.buildVideosRequestUrl(this.videoId.trim());

    this.httpClient.get<YoutubeVideosResponse>(requestUrl).subscribe({
      next: (response) => this.handleVideoResponse(response),
      error: (error) => this.handleHttpError(error),
    });
  }

  private isVideoIdValid(): boolean {
    const videoIdTrimmed = this.videoId.trim();
    const videoIdRegex = /^[a-zA-Z0-9_-]{11}$/;
    return videoIdRegex.test(videoIdTrimmed);
  }

  private buildVideosRequestUrl(videoId: string): string {
    const encodedVideoId = encodeURIComponent(videoId);
    const encodedApiKey = encodeURIComponent(environment.youtubeApiKey);

    return (
      'https://www.googleapis.com/youtube/v3/videos' +
      `?part=snippet,statistics&id=${encodedVideoId}&key=${encodedApiKey}`
    );
  }

  private handleVideoResponse(response: YoutubeVideosResponse): void {
    this.isLoading = false;

    const videoItem = response.items?.[0];
    if (!videoItem) {
      this.showTranslatedError('errors.noVideoFound');
      return;
    }

    this.videoTitle = videoItem.snippet.title;
    this.channelTitle = videoItem.snippet.channelTitle;
    this.publishedAt = new Date(videoItem.snippet.publishedAt).toLocaleString();
    this.viewCount = this.parseStatistic(videoItem.statistics.viewCount);
    this.likeCount = this.parseStatistic(videoItem.statistics.likeCount);
    this.commentCount = this.parseStatistic(videoItem.statistics.commentCount);
    this.lastFetchDate = new Date();
  }

  private parseStatistic(value?: string): number {
    if (!value) {
      return 0;
    }

    const parsedValue = Number.parseInt(value, 10);
    return Number.isNaN(parsedValue) ? 0 : parsedValue;
  }

  private handleHttpError(error: HttpErrorResponse): void {
    this.isLoading = false;
    console.error('Fehler bei HTTP-Request:', error);

    if (error.status === 0) {
      this.showTranslatedError('errors.network');
      return;
    }

    this.showTranslatedError('errors.api');
  }

  private showTranslatedError(errorKey: string): void {
    this.translateService
      .get(['errors.title', errorKey])
      .subscribe((translations: Record<string, string>) => {
        this.showErrorAlert(translations['errors.title'], translations[errorKey]);
      });
  }

  private async showErrorAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });

    await alert.present();
  }

}
