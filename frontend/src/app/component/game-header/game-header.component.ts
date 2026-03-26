import { Component, input } from '@angular/core';

@Component({
  selector: 'app-game-header',
  standalone: true,
  templateUrl: './game-header.component.html',
  styleUrl: './game-header.component.scss',
})
export class GameHeaderComponent {
  readonly title = input<string>('SUTOM');
}
