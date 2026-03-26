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

const SECRET_PAR_DEFAUT = "LIVRE";

function demarrerPartie(words: string[], secret = SECRET_PAR_DEFAUT) {
  const dictionary = new FakeDictionary(new Set(words));
  const provider = new FakeSecretWordProvider(secret);
  return startGame(dictionary, provider);
}

function exigerDemarrageOk(result: any) {
  if (!result.ok) throw new Error("Demarrage attendu en succes");
  return result.value;
}

function exigerSoumissionOk(result: any) {
  if (!result.ok) throw new Error("Soumission attendue en succes");
  return result.value;
}

describe("Domaine Wordle - Point 1 tests nominaux", () => {
  it("demarre une partie en cours avec zero tentative", () => {
    // Given
    const words = ["LIVRE", "RAMER", "MOTIF"];

    // When
    const result = demarrerPartie(words);

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
    const game = exigerDemarrageOk(demarrerPartie(["LIVRE", "MOTIF"]));

    // When
    const result = submitGuess(game, "MOTIF");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("IN_PROGRESS");
      expect(result.value.attempts).toHaveLength(1);
    }
  });

  it("passe la partie a WON quand le joueur trouve le mot secret", () => {
    // Given
    const game = exigerDemarrageOk(demarrerPartie(["LIVRE"]));

    // When
    const result = submitGuess(game, "LIVRE");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("WON");
      expect(result.value.attempts).toHaveLength(1);
    }
  });

  it("passe la partie a LOST apres six tentatives non gagnantes", () => {
    // Given
    let game = exigerDemarrageOk(demarrerPartie(["LIVRE", "MOTIF"]));

    // When
    for (let i = 0; i < 6; i += 1) {
      game = exigerSoumissionOk(submitGuess(game, "MOTIF"));
    }

    // Then
    expect(game.status).toBe("LOST");
    expect(game.attempts).toHaveLength(6);
  });
});

describe("Domaine Wordle - Point 2 tests d erreurs", () => {
  it("rejette un mot qui n est pas dans le dictionnaire", () => {
    // Given
    const game = exigerDemarrageOk(demarrerPartie(["LIVRE"]));

    // When
    const result = submitGuess(game, "RAMER");

    // Then
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("WordNotInDictionary");
    }
  });

  it("rejette un mot de longueur invalide", () => {
    // Given
    const game = exigerDemarrageOk(demarrerPartie(["LIVRE"]));

    // When
    const result = submitGuess(game, "LIV");

    // Then
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("InvalidWordLength");
    }
    expect(game.attempts).toHaveLength(0);
  });

  it("accepte un mot en minuscules en le normalisant", () => {
    // Given
    const game = exigerDemarrageOk(demarrerPartie(["LIVRE"]));

    // When
    const result = submitGuess(game, "livre");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("WON");
      expect(result.value.attempts).toHaveLength(1);
    }
  });

  it("rejette un mot avec des caracteres invalides", () => {
    // Given
    const game = exigerDemarrageOk(demarrerPartie(["LIVRE"]));

    // When
    const result = submitGuess(game, "LIVR1");

    // Then
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("InvalidWordCharacters");
    }
  });

  it("rejette une soumission quand la partie est deja terminee", () => {
    // Given
    const game = exigerDemarrageOk(demarrerPartie(["LIVRE"]));
    const wonGame = exigerSoumissionOk(submitGuess(game, "LIVRE"));

    // When
    const result = submitGuess(wonGame, "LIVRE");

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
    const game = exigerDemarrageOk(demarrerPartie(["LIVRE", "RAMER"]));

    // When
    const result = submitGuess(game, "RAMER");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      const feedback = result.value.attempts[0].result.letters.map((x) => x.feedback);
      expect(feedback).toEqual(["MISPLACED", "ABSENT", "ABSENT", "MISPLACED", "ABSENT"]);
    }
  });

  it("marque ABSENT les occurrences surnumeraires d une lettre", () => {
    // Given
    const game = exigerDemarrageOk(demarrerPartie(["LIVRE", "RARER"]));

    // When
    const result = submitGuess(game, "RARER");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      const feedback = result.value.attempts[0].result.letters.map((x) => x.feedback);
      expect(feedback).toEqual(["MISPLACED", "ABSENT", "ABSENT", "MISPLACED", "ABSENT"]);
    }
  });

  it("rejette une soumission apres une defaite", () => {
    // Given
    let game = exigerDemarrageOk(demarrerPartie(["LIVRE", "MOTIF"]));
    for (let i = 0; i < 6; i += 1) {
      game = exigerSoumissionOk(submitGuess(game, "MOTIF"));
    }

    // When
    const result = submitGuess(game, "MOTIF");

    // Then
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("GameAlreadyFinished");
    }
  });

  it("gere correctement les doublons dans le mot secret", () => {
    // Given
    const game = exigerDemarrageOk(demarrerPartie(["BALLE", "ALLEE"], "BALLE"));

    // When
    const result = submitGuess(game, "ALLEE");

    // Then
    expect(result.ok).toBe(true);
    if (result.ok) {
      const feedback = result.value.attempts[0].result.letters.map((x) => x.feedback);
      expect(feedback).toEqual(["MISPLACED", "MISPLACED", "CORRECT", "ABSENT", "CORRECT"]);
    }
  });
});
