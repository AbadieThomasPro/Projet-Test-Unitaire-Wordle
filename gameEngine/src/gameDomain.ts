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

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6 as const;

// Keep dictionary decoupled from GameState shape while preserving immutability.
const dictionaryByGame = new WeakMap<GameState, Dictionary>();

function normalizeWord(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase();
}

function foldAccents(value: string): string {
	return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function validateWordShape(value: string): Result<Word> {
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

export type FetchLike = (
	input: string,
	init?: {
		method?: string;
		headers?: Record<string, string>;
	},
) => Promise<{
	ok: boolean;
	status: number;
	json(): Promise<unknown>;
}>;

function getGlobalFetch(): FetchLike {
	return fetch as unknown as FetchLike;
}

function extractWordFromPayload(payload: unknown): string | null {
	if (Array.isArray(payload)) {
		if (payload.length === 0) {
			return null;
		}

		const first = payload[0];
		if (!first || typeof first !== "object") {
			return null;
		}

		const item = first as Record<string, unknown>;
		const arrayCandidates = [
			item["name"],
			item["word"],
			item["mot"],
			item["value"],
			item["result"],
		];

		for (const candidate of arrayCandidates) {
			if (typeof candidate === "string") {
				return candidate;
			}
		}

		return null;
	}

	if (typeof payload === "string") {
		return payload;
	}

	if (!payload || typeof payload !== "object") {
		return null;
	}

	const data = payload as Record<string, unknown>;
	const candidates = [data["word"], data["mot"], data["value"], data["result"]];
	for (const candidate of candidates) {
		if (typeof candidate === "string") {
			return candidate;
		}
	}

	return null;
}

function extractBooleanFromPayload(payload: unknown): boolean {
	if (Array.isArray(payload)) {
		return payload.length > 0;
	}

	if (typeof payload === "boolean") {
		return payload;
	}

	if (!payload || typeof payload !== "object") {
		return false;
	}

	const data = payload as Record<string, unknown>;
	const success = data["success"];
	const responseData = data["data"];
	if (success === true && Array.isArray(responseData)) {
		return responseData.length > 0;
	}

	if (success === true && responseData && typeof responseData === "object") {
		const dataObject = responseData as Record<string, unknown>;
		const words = dataObject["words"];
		if (Array.isArray(words)) {
			return words.length > 0;
		}

		const totalCount = dataObject["totalCount"];
		if (typeof totalCount === "number") {
			return totalCount > 0;
		}
	}

	const candidates = [data["valid"], data["exists"], data["ok"], data["found"]];
	return candidates.some((value) => value === true);
}

function payloadContainsWord(payload: unknown, expected: string): boolean {
	const expectedFolded = foldAccents(expected).toLowerCase();

	if (!payload || typeof payload !== "object") {
		return false;
	}

	const data = payload as Record<string, unknown>;
	const entries = data["data"];

	if (Array.isArray(entries)) {
		for (const entry of entries) {
			if (!entry || typeof entry !== "object") {
				continue;
			}

			const record = entry as Record<string, unknown>;
			const wordCandidate = record["word"] ?? record["name"] ?? record["mot"];
			if (typeof wordCandidate !== "string") {
				continue;
			}

			const folded = foldAccents(wordCandidate).toLowerCase();
			if (folded === expectedFolded) {
				return true;
			}
		}
	}

	if (entries && typeof entries === "object") {
		const dataObject = entries as Record<string, unknown>;
		const words = dataObject["words"];
		if (Array.isArray(words)) {
			for (const candidate of words) {
				if (typeof candidate !== "string") {
					continue;
				}

				const folded = foldAccents(candidate).toLowerCase();
				if (folded === expectedFolded) {
					return true;
				}
			}
		}
	}

	return false;
}

export async function getSecretWordFromTrouveMotApi(
	url: string,
	fetcher: FetchLike = getGlobalFetch(),
): Promise<Result<Word>> {
	const response = await fetcher(url, { method: "GET" });
	if (!response.ok) {
		return { ok: false, error: { type: "InvalidWordCharacters", value: `HTTP_${response.status}` } };
	}

	const payload = await response.json();
	const candidate = extractWordFromPayload(payload);
	if (!candidate) {
		return { ok: false, error: { type: "InvalidWordCharacters", value: "MISSING_WORD" } };
	}

	return validateWordShape(candidate);
}

export async function checkWordWithDicoLinkApi(
	baseUrl: string,
	word: string,
	fetcher: FetchLike = getGlobalFetch(),
): Promise<boolean> {
	const queryWord = foldAccents(word.trim()).toLowerCase();
	if (queryWord.length === 0) {
		return false;
	}

	const cleanedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
	const url = `${cleanedBaseUrl}?contains=${encodeURIComponent(queryWord)}&length=${WORD_LENGTH}`;
	const response = await fetcher(url, { method: "GET" });

	if (!response.ok) {
		return false;
	}

	const payload = await response.json();
	if (!extractBooleanFromPayload(payload)) {
		return false;
	}

	return payloadContainsWord(payload, queryWord);
}

export interface ApiDictionary extends Dictionary {
	ensureContains(word: string): Promise<boolean>;
	addKnownWord(word: Word): void;
}

export class DicoLinkApiDictionary implements ApiDictionary {
	private readonly knownWords = new Set<Word>();

	constructor(
		private readonly baseUrl: string,
		private readonly fetcher: FetchLike = getGlobalFetch(),
	) {}

	contains(word: Word): boolean {
		return this.knownWords.has(word);
	}

	addKnownWord(word: Word): void {
		this.knownWords.add(word);
	}

	async ensureContains(word: string): Promise<boolean> {
		const shape = validateWordShape(word);
		if (!shape.ok) {
			return false;
		}

		if (this.contains(shape.value)) {
			return true;
		}

		const exists = await checkWordWithDicoLinkApi(this.baseUrl, shape.value, this.fetcher);
		if (exists) {
			this.addKnownWord(shape.value);
		}

		return exists;
	}
}

export async function startGameFromApis(
	trouveMotApiUrl: string,
	dictionary: ApiDictionary,
	fetcher: FetchLike = getGlobalFetch(),
): Promise<Result<GameState>> {
	const secretResult = await getSecretWordFromTrouveMotApi(trouveMotApiUrl, fetcher);
	if (!secretResult.ok) {
		return secretResult;
	}

	dictionary.addKnownWord(secretResult.value);

	const provider: SecretWordProvider = {
		pickSecret: () => secretResult.value,
	};

	return startGame(dictionary, provider);
}

export async function submitGuessWithApiDictionary(
	game: GameState,
	guessInput: string,
	dictionary: ApiDictionary,
): Promise<Result<GameState>> {
	const shape = validateWordShape(guessInput);
	if (!shape.ok) {
		return shape;
	}

	if (shape.value === game.secret) {
		dictionary.addKnownWord(shape.value);
		return submitGuess(game, shape.value);
	}

	const exists = await dictionary.ensureContains(shape.value);
	if (!exists) {
		return { ok: false, error: { type: "WordNotInDictionary", value: shape.value } };
	}

	return submitGuess(game, shape.value);
}
