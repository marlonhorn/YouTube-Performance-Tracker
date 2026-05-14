import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private translateService: TranslateService,
    private platform: Platform,
  ) {
    this.platform.ready().then(() => {
      this.initializeTranslations();
    });
  }

  private initializeTranslations(): void {
    this.translateService.setDefaultLang('en');

    const browserLanguage = this.translateService.getBrowserLang();
    const selectedLanguage = browserLanguage === 'de' ? 'de' : 'en';

    this.translateService.use(selectedLanguage);
  }
}
