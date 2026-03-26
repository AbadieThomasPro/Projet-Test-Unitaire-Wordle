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

// Ports (interfaces)
export interface Dictionary {
  contains(word: Word): boolean;
}

export interface SecretWordProvider {
  pickSecret(): Word;
}

// Erreurs metier typees
export type DomainError =
  | { type: "InvalidWordLength"; expected: 5; actual: number }
  | { type: "InvalidWordCharacters"; value: string }
  | { type: "WordNotInDictionary"; value: string }
  | { type: "GameAlreadyFinished"; status: Exclude<GameStatus, "IN_PROGRESS"> }
  | { type: "MaxAttemptsReached"; maxAttempts: 6 };