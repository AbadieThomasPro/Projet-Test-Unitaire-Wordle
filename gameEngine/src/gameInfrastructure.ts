import { startGame, submitGuess, validateWordShape, WORD_LENGTH, type DomainResult } from "./gameDomain";
import type { Dictionary, GameState, SecretWordProvider, Word } from "./types";

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

function foldAccents(value: string): string {
	return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
): Promise<DomainResult<Word>> {
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
): Promise<DomainResult<GameState>> {
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
): Promise<DomainResult<GameState>> {
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
