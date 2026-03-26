import { Component, input } from '@angular/core';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-status-banner',
  standalone: true,
  imports: [MessageModule, ProgressSpinnerModule],
  templateUrl: './status-banner.component.html',
  styleUrl: './status-banner.component.scss',
})
export class StatusBannerComponent {
  readonly text = input<string>('');
  readonly loading = input<boolean>(false);
}
