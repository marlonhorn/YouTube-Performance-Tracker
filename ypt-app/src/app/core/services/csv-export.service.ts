import { Injectable } from '@angular/core';
import { StoredEntry } from './storage.service';

@Injectable({ providedIn: 'root' })
export class CsvExportService {

  /** Generate a CSV string from saved entries. */
  public generateCsv(entries: StoredEntry[]): string {
    const headers = [
      'Title', 'Channel', 'Published', 'Views', 'Likes', 'Comments',
      'L/V %', 'L/C Ratio', 'Score', 'Tags', 'Note', 'Saved At',
    ];
    const rows = entries.map(e => [
      e.title,
      e.channelTitle,
      e.publishedAt,
      String(e.viewCount),
      String(e.likeCount),
      String(e.commentCount),
      this.ratio(e.likeCount, e.viewCount, 4),
      this.ratio(e.likeCount, e.commentCount, 2),
      String(this.calcScore(e.viewCount, e.likeCount)),
      (e.tags ?? []).join('; '),
      e.userNote,
      new Date(e.timestamp).toLocaleString(),
    ]);
    return [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  /** Trigger a browser file download of the given CSV content. */
  public download(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private ratio(numerator: number, denominator: number, decimals: number): string {
    return denominator > 0 ? (numerator / denominator).toFixed(decimals) : '0';
  }

  private calcScore(viewCount: number, likeCount: number): number {
    const popularity  = Math.min(Math.log10(viewCount + 1) / 8, 1) * 50;
    const engagement  = Math.min(likeCount / (viewCount || 1) * 1000, 50);
    return Math.round(popularity + engagement);
  }
}
