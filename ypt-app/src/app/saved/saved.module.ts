import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { SavedPage } from './saved.page';
import { SavedPageRoutingModule } from './saved-routing.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SavedPageRoutingModule,
    TranslateModule,
  ],
  declarations: [SavedPage],
})
export class SavedPageModule {}
