import type {
	Attempt,
	Dictionary,
	DomainError,
	EvaluatedLetter,
	GameState,
	LetterFeedback,
	SecretWordProvider,
	Word,
} from "./types";

type Result<T> =
	| { ok: true; value: T }
	| { ok: false; error: DomainError };

export type DomainResult<T> = Result<T>;

export const WORD_LENGTH = 5 as const;
export const MAX_ATTEMPTS = 6 as const;

// Keep dictionary decoupled from GameState shape while preserving immutability.
const dictionaryByGame = new WeakMap<GameState, Dictionary>();

function normalizeWord(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase();
}

export function validateWordShape(value: string): Result<Word> {
	const normalized = normalizeWord(value);

	if (normalized.length !== WORD_LENGTH) {
		return {
			ok: false,
			error: { type: "InvalidWordLength", expected: 5, actual: normalized.length },
		};
	}

	if (!/^[A-Z]{5}$/.test(normalized)) {
		return {
			ok: false,
			error: { type: "InvalidWordCharacters", value },
		};
	}

	return { ok: true, value: normalized as Word };
}

function evaluateGuess(secret: string, guess: string): readonly EvaluatedLetter[] {
	const feedback: LetterFeedback[] = Array(WORD_LENGTH).fill("ABSENT");
	const remainingSecretCounts = new Map<string, number>();

	for (let i = 0; i < WORD_LENGTH; i += 1) {
		const secretChar = secret[i];
		const guessChar = guess[i];

		if (guessChar === secretChar) {
			feedback[i] = "CORRECT";
		} else {
			const current = remainingSecretCounts.get(secretChar) ?? 0;
			remainingSecretCounts.set(secretChar, current + 1);
		}
	}

	for (let i = 0; i < WORD_LENGTH; i += 1) {
		if (feedback[i] === "CORRECT") {
			continue;
		}

		const guessChar = guess[i];
		const available = remainingSecretCounts.get(guessChar) ?? 0;

		if (available > 0) {
			feedback[i] = "MISPLACED";
			remainingSecretCounts.set(guessChar, available - 1);
		}
	}

	return guess.split("").map((letter, index) => ({
		letter,
		feedback: feedback[index],
	}));
}

function getDictionary(game: GameState): Dictionary | undefined {
	return dictionaryByGame.get(game);
}

function linkDictionary(game: GameState, dictionary: Dictionary): void {
	dictionaryByGame.set(game, dictionary);
}

export function startGame(
	dictionary: Dictionary,
	provider: SecretWordProvider,
): Result<GameState> {
	const secretCandidate = provider.pickSecret();
	const secretValidation = validateWordShape(String(secretCandidate));
	if (!secretValidation.ok) {
		return secretValidation;
	}

	const secret = secretValidation.value;
	if (!dictionary.contains(secret)) {
		return { ok: false, error: { type: "WordNotInDictionary", value: secret } };
	}

	const game: GameState = {
		secret,
		maxAttempts: MAX_ATTEMPTS,
		attempts: [],
		status: "IN_PROGRESS",
	};

	linkDictionary(game, dictionary);
	return { ok: true, value: game };
}

export function submitGuess(game: GameState, guessInput: string): Result<GameState> {
	if (game.status !== "IN_PROGRESS") {
		return { ok: false, error: { type: "GameAlreadyFinished", status: game.status } };
	}

	if (game.attempts.length >= MAX_ATTEMPTS) {
		return { ok: false, error: { type: "MaxAttemptsReached", maxAttempts: MAX_ATTEMPTS } };
	}

	const validatedGuess = validateWordShape(guessInput);
	if (!validatedGuess.ok) {
		return validatedGuess;
	}

	const dictionary = getDictionary(game);
	if (!dictionary) {
		return { ok: false, error: { type: "WordNotInDictionary", value: validatedGuess.value } };
	}

	if (!dictionary.contains(validatedGuess.value)) {
		return {
			ok: false,
			error: { type: "WordNotInDictionary", value: validatedGuess.value },
		};
	}

	const letters = evaluateGuess(game.secret, validatedGuess.value);
	const attempt: Attempt = {
		turn: game.attempts.length + 1,
		result: {
			guess: validatedGuess.value as any,
			letters,
		},
	};

	const attempts = [...game.attempts, attempt];
	const isWon = validatedGuess.value === game.secret;
	const isLost = !isWon && attempts.length >= MAX_ATTEMPTS;

	const nextGame: GameState = {
		...game,
		attempts,
		status: isWon ? "WON" : isLost ? "LOST" : "IN_PROGRESS",
	};

	linkDictionary(nextGame, dictionary);
	return { ok: true, value: nextGame };
}
