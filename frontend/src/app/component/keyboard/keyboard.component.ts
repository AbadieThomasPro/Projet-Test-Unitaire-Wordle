import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TileState } from '../word-grid/word-grid.component';

@Component({
  selector: 'app-keyboard',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './keyboard.component.html',
  styleUrl: './keyboard.component.scss',
})
export class KeyboardComponent {
  readonly disabled = input<boolean>(false);
  readonly keyStates = input<Record<string, TileState>>({});

  readonly keyPressed = output<string>();

  readonly rows = [
    ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
    ['W', 'X', 'C', 'V', 'B', 'N'],
  ];

  emitKey(value: string): void {
    if (this.disabled()) {
      return;
    }
    this.keyPressed.emit(value);
  }

  stateOf(letter: string): TileState {
    return this.keyStates()[letter] ?? 'empty';
  }
}
