import { Component, input } from '@angular/core';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-status-banner',
  standalone: true,
  imports: [MessageModule],
  templateUrl: './status-banner.component.html',
  styleUrl: './status-banner.component.scss',
})
export class StatusBannerComponent {
  readonly text = input<string>('');
}
