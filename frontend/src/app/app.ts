import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { GameHeaderComponent } from './component/game-header/game-header.component';
import { KeyboardComponent } from './component/keyboard/keyboard.component';
import {
  EvaluatedRow,
  TileState,
  WordGridComponent,
} from './component/word-grid/word-grid.component';
import { StatusBannerComponent } from './component/status-banner/status-banner.component';
import {
  DicoLinkApiDictionary,
  submitGuessWithApiDictionary,
  startGameFromApis,
} from '../../../gameEngine/src/gameDomain';
import type { DomainError, GameState } from '../../../gameEngine/src/types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [GameHeaderComponent, StatusBannerComponent, WordGridComponent, KeyboardComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly maxAttempts = 6;
  readonly wordLength = 5;

  // TODO: remplacer par tes vraies URLs.
  private readonly trouveMotApiUrl = 'https://trouve-mot.fr/api/size/5';
  private readonly dicoLinkApiUrl = 'https://api.poocoo.fr/api/v1/words';
  private dictionary: DicoLinkApiDictionary | null = null;
  private readonly gameState = signal<GameState | null>(null);

  readonly currentGuess = signal('');
  readonly evaluatedRows = signal<readonly EvaluatedRow[]>([]);
  readonly message = signal('Chargement de la partie...');
  readonly isLoading = signal(false);
  readonly isGameFinished = computed(() => this.gameState()?.status !== 'IN_PROGRESS');
  readonly keyStates = signal<Record<string, TileState>>({});

  async ngOnInit(): Promise<void> {
    await this.initializeGame();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyboardEvent(event: KeyboardEvent): void {
    const key = event.key;

    if (key === 'Backspace') {
      event.preventDefault();
      this.handleInput('BACKSPACE');
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      this.handleInput('ENTER');
      return;
    }

    if (/^[a-zA-Z]$/.test(key)) {
      this.handleInput(key.toUpperCase());
    }
  }

  handleInput(value: string): void {
    if (this.isLoading() || this.isGameFinished()) {
      return;
    }

    if (value === 'BACKSPACE') {
      this.currentGuess.update((guess) => guess.slice(0, -1));
      return;
    }

    if (value === 'ENTER') {
      void this.submitCurrentGuess();
      return;
    }

    if (!/^[A-Z]$/.test(value)) {
      return;
    }

    this.currentGuess.update((guess) => {
      if (guess.length >= this.wordLength) {
        return guess;
      }
      return guess + value;
    });
  }

  private async initializeGame(): Promise<void> {
    this.isLoading.set(true);
    this.message.set('Chargement de la partie...');

    const dictionary = new DicoLinkApiDictionary(this.dicoLinkApiUrl);
    const result = await startGameFromApis(this.trouveMotApiUrl, dictionary);

    if (!result.ok) {
      this.message.set(this.toUserMessage(result.error));
      this.isLoading.set(false);
      return;
    }

    this.dictionary = dictionary;
    this.gameState.set(result.value);
    this.syncViewFromGame(result.value);
    this.message.set('');
    this.isLoading.set(false);
  }

  private async submitCurrentGuess(): Promise<void> {
    const game = this.gameState();
    if (!game || !this.dictionary) {
      this.message.set("La partie n'est pas prete.");
      return;
    }

    const result = await submitGuessWithApiDictionary(game, this.currentGuess(), this.dictionary);
    if (!result.ok) {
      this.message.set(this.toUserMessage(result.error));
      return;
    }

    this.gameState.set(result.value);
    this.syncViewFromGame(result.value);
    this.currentGuess.set('');

    if (result.value.status === 'WON') {
      this.message.set('Bravo, mot trouve.');
      return;
    }

    if (result.value.status === 'LOST') {
      this.message.set('Perdu.');
      return;
    }

    this.message.set('');
  }

  private syncViewFromGame(game: GameState): void {
    const rows: EvaluatedRow[] = game.attempts.map((attempt) =>
      attempt.result.letters.map((cell) => ({
        letter: cell.letter,
        state: this.toTileState(cell.feedback),
      })),
    );

    this.evaluatedRows.set(rows);
    this.keyStates.set(this.computeKeyStates(rows));
  }

  private toTileState(feedback: 'CORRECT' | 'MISPLACED' | 'ABSENT'): TileState {
    if (feedback === 'CORRECT') {
      return 'correct';
    }
    if (feedback === 'MISPLACED') {
      return 'present';
    }
    return 'absent';
  }

  private computeKeyStates(rows: readonly EvaluatedRow[]): Record<string, TileState> {
    const rank: Record<TileState, number> = {
      empty: 0,
      absent: 1,
      present: 2,
      correct: 3,
    };

    const keyStates: Record<string, TileState> = {};
    for (const row of rows) {
      for (const cell of row) {
        const prev = keyStates[cell.letter] ?? 'empty';
        if (rank[cell.state] > rank[prev]) {
          keyStates[cell.letter] = cell.state;
        }
      }
    }

    return keyStates;
  }

  private toUserMessage(error: DomainError): string {
    switch (error.type) {
      case 'InvalidWordLength':
        return `Le mot doit contenir ${this.wordLength} lettres.`;
      case 'InvalidWordCharacters':
        return 'Le mot contient des caracteres invalides.';
      case 'WordNotInDictionary':
        return "Ce mot n'est pas dans notre dictionnaire.";
      case 'GameAlreadyFinished':
        return 'La partie est deja terminee.';
      case 'MaxAttemptsReached':
        return 'Le nombre de tentatives maximum est atteint.';
      default:
        return 'Erreur metier.';
    }
  }

}
