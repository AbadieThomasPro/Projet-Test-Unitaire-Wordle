import { describe, it, expect } from "vitest";
import { startGame, submitGuess } from "../gameDomain";
import type { Dictionary, SecretWordProvider } from "../types";

class FakeDictionary implements Dictionary {
  // Fake: comportement realiste minimal, lisible et deterministe pour les tests metier
  constructor(private readonly words: Set<string>) {}

  contains(word: any): boolean {
    return this.words.has(String(word));
  }
}

class FakeSecretWordProvider implements SecretWordProvider {
  // Fake: permet de controler le mot secret pour des tests deterministes
  constructor(private readonly secret: any) {}

  pickSecret() {
    return this.secret;
  }
}

describe("Domaine Wordle - Point 1 tests nominaux", () => {
  it("demarre une partie en cours avec zero tentative", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE", "RAMER", "MOTIF"]));
    const provider = new FakeSecretWordProvider("LIVRE");

    // When
    const result = startGame(dictionary, provider);

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("IN_PROGRESS");
      expect(result.value.maxAttempts).toBe(6);
      expect(result.value.attempts).toHaveLength(0);
    }
  });

  it("accepte une soumission valide qui ne termine pas la partie", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE", "MOTIF"]));
    const provider = new FakeSecretWordProvider("LIVRE");
    const gameResult = startGame(dictionary, provider);
    if (!gameResult.ok) throw new Error("Demarrage attendu en succes");

    // When
    const result = submitGuess(gameResult.value, "MOTIF");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("IN_PROGRESS");
      expect(result.value.attempts).toHaveLength(1);
    }
  });

  it("passe la partie a WON quand le joueur trouve le mot secret", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE"]));
    const provider = new FakeSecretWordProvider("LIVRE");
    const gameResult = startGame(dictionary, provider);
    if (!gameResult.ok) throw new Error("Demarrage attendu en succes");

    // When
    const result = submitGuess(gameResult.value, "LIVRE");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("WON");
      expect(result.value.attempts).toHaveLength(1);
    }
  });

  it("passe la partie a LOST apres six tentatives non gagnantes", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE", "MOTIF"]));
    const provider = new FakeSecretWordProvider("LIVRE");
    let gameResult = startGame(dictionary, provider);
    if (!gameResult.ok) throw new Error("Demarrage attendu en succes");

    // When
    for (let i = 0; i < 6; i += 1) {
      const next = submitGuess(gameResult.value, "MOTIF");
      if (!next.ok) throw new Error("Soumission attendue en succes");
      gameResult = { ok: true, value: next.value };
    }

    // Then
    expect(gameResult.value.status).toBe("LOST");
    expect(gameResult.value.attempts).toHaveLength(6);
  });
});

describe("Domaine Wordle - Point 2 tests d erreurs", () => {
  it("rejette un mot qui n est pas dans le dictionnaire", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE"]));
    const provider = new FakeSecretWordProvider("LIVRE");
    const gameResult = startGame(dictionary, provider);
    if (!gameResult.ok) throw new Error("Demarrage attendu en succes");

    // When
    const result = submitGuess(gameResult.value, "RAMER");

    // Then
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("WordNotInDictionary");
    }
  });

  it("rejette un mot de longueur invalide", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE"]));
    const provider = new FakeSecretWordProvider("LIVRE");
    const gameResult = startGame(dictionary, provider);
    if (!gameResult.ok) throw new Error("Demarrage attendu en succes");

    // When
    const result = submitGuess(gameResult.value, "LIV");

    // Then
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("InvalidWordLength");
    }
  });

  it("rejette un mot avec des caracteres invalides", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE"]));
    const provider = new FakeSecretWordProvider("LIVRE");
    const gameResult = startGame(dictionary, provider);
    if (!gameResult.ok) throw new Error("Demarrage attendu en succes");

    // When
    const result = submitGuess(gameResult.value, "LIVR1");

    // Then
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("InvalidWordCharacters");
    }
  });

  it("rejette une soumission quand la partie est deja terminee", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE"]));
    const provider = new FakeSecretWordProvider("LIVRE");
    const gameResult = startGame(dictionary, provider);
    if (!gameResult.ok) throw new Error("Demarrage attendu en succes");

    const wonResult = submitGuess(gameResult.value, "LIVRE");
    if (!wonResult.ok) throw new Error("Victoire attendue dans ce test");

    // When
    const result = submitGuess(wonResult.value, "LIVRE");

    // Then
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("GameAlreadyFinished");
    }
  });
});

describe("Domaine Wordle - Point 3 cas limites", () => {
  it("applique correctement la regle des lettres multiples sur le cas LIVRE/RAMER", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE", "RAMER"]));
    const provider = new FakeSecretWordProvider("LIVRE");
    const gameResult = startGame(dictionary, provider);
    if (!gameResult.ok) throw new Error("Demarrage attendu en succes");

    // When
    const result = submitGuess(gameResult.value, "RAMER");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      const feedback = result.value.attempts[0].result.letters.map((x) => x.feedback);
      expect(feedback).toEqual(["MISPLACED", "ABSENT", "ABSENT", "MISPLACED", "ABSENT"]);
    }
  });

  it("marque ABSENT les occurrences surnumeraires d une lettre", () => {
    // Given
    const dictionary = new FakeDictionary(new Set(["LIVRE", "RARER"]));
    const provider = new FakeSecretWordProvider("LIVRE");
    const gameResult = startGame(dictionary, provider);
    if (!gameResult.ok) throw new Error("Demarrage attendu en succes");

    // When
    const result = submitGuess(gameResult.value, "RARER");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      const feedback = result.value.attempts[0].result.letters.map((x) => x.feedback);
      expect(feedback).toEqual(["MISPLACED", "ABSENT", "ABSENT", "CORRECT", "ABSENT"]);
    }
  });
});
