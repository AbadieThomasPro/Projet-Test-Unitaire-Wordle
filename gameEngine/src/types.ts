export type Word = string & { readonly _brand: "Word" };
export type Guess = Word & { readonly _guessBrand: "Guess" };

export type LetterFeedback = "CORRECT" | "MISPLACED" | "ABSENT";

export type EvaluatedLetter = {
  letter: string;
  feedback: LetterFeedback;
};

export type GuessResult = {
  guess: Guess;
  letters: readonly EvaluatedLetter[]; // taille 5 attendue
};

export type GameStatus = "IN_PROGRESS" | "WON" | "LOST";

export type Attempt = {
  turn: number;
  result: GuessResult;
};

export type GameState = {
  secret: Word;
  maxAttempts: 6;
  attempts: readonly Attempt[];
  status: GameStatus;
};
