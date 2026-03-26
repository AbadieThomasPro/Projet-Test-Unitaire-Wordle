import { Component, computed, input } from '@angular/core';

export type TileState = 'empty' | 'correct' | 'present' | 'absent';

export type EvaluatedRow = ReadonlyArray<{
  letter: string;
  state: TileState;
}>;

@Component({
  selector: 'app-word-grid',
  standalone: true,
  templateUrl: './word-grid.component.html',
  styleUrl: './word-grid.component.scss',
})
export class WordGridComponent {
  readonly rows = input<readonly EvaluatedRow[]>([]);
  readonly currentGuess = input<string>('');
  readonly maxRows = input<number>(6);
  readonly wordLength = input<number>(8);

  readonly displayRows = computed(() => {
    const built: EvaluatedRow[] = [];
    const evaluated = this.rows();
    const len = this.wordLength();
    const total = this.maxRows();

    for (let rowIndex = 0; rowIndex < total; rowIndex += 1) {
      if (rowIndex < evaluated.length) {
        built.push(evaluated[rowIndex]);
        continue;
      }

      if (rowIndex === evaluated.length) {
        const guess = this.currentGuess().padEnd(len, ' ');
        built.push(
          guess.split('').map((letter) => ({
            letter: letter.trim(),
            state: 'empty',
          })),
        );
        continue;
      }

      built.push(
        Array.from({ length: len }, () => ({
          letter: '',
          state: 'empty',
        })),
      );
    }

    return built;
  });
}
