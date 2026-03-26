import { Component, ElementRef, HostListener, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-game-header',
  standalone: true,
  templateUrl: './game-header.component.html',
  styleUrl: './game-header.component.scss',
})
export class GameHeaderComponent {
  readonly headerTitle = input<string>('WORDLE');
  readonly restartRequested = output<void>();
  readonly showHelp = signal(false);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  toggleHelp(event: MouseEvent): void {
    event.stopPropagation();
    this.showHelp.update((value) => !value);
  }

  requestRestart(): void {
    this.restartRequested.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showHelp()) {
      return;
    }

    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) {
      return;
    }

    this.showHelp.set(false);
  }
}
