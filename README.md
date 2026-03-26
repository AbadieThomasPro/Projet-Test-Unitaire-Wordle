# Projet d'evaluation - Wordle

Ce depot contient:
- `gameEngine`: domaine metier Wordle + tests unitaires Vitest
- `frontend`: interface Angular jouable qui consomme le gameEngine

## 1. Recuperer le projet

```bash
git clone <URL_DU_DEPOT>
cd Projet-Test-Unitaire-Wordle
```

## 2. Installer les dependances

Installer les dependances de chaque module:

```bash
cd gameEngine
npm i
cd ../frontend
npm i
cd ..
```

## 3. Lancer les tests unitaires (domaine metier)

```bash
cd gameEngine
npx vitest run
```

Option watch:

```bash
npm test
```

## 4. Lancer l'application frontend

```bash
cd frontend
npm start
```

Puis ouvrir:
- `http://localhost:4200`

## 5. Build de verification

Build du frontend:

```bash
cd frontend
npm run build
```

## 6. Architecture (resume)

- Le domaine Wordle est dans `gameEngine/src/gameDomain.ts` (logique metier pure).
- L'infrastructure API est dans `gameEngine/src/gameInfrastructure.ts` (HTTP/fetch et adaptateurs dictionnaire).
- L'API publique du moteur est exposee via `gameEngine/src/index.ts`.
- Le frontend consomme uniquement ce point d'entree public.

## 7. Regles metier couvertes

- Mot secret de 5 lettres
- 6 tentatives maximum
- Feedback par lettre: `CORRECT`, `MISPLACED`, `ABSENT`
- Regle des lettres multiples (occurrences limitees par le mot secret)
- Gestion des erreurs metier (longueur invalide, caracteres invalides, mot hors dictionnaire, partie terminee)
