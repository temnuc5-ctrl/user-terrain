# Prompt Copilot — HSELY : Page de démarrage (Splash Screen)

## Rôle

Tu es un agent de codage GitHub. Applique ces modifications sur une nouvelle branche `feat/hsely-splash-screen`, puis ouvre une Pull Request vers `main`. Ne pousse rien directement sur `main`.

## Contexte du dépôt

- SPA statique **Vite + React + TypeScript + Tailwind v4**.
- Router : **React Router v6** avec les routes `/rapport/accueil`, `/rapport/secteur`, `/rapport/identification`, `/rapport/verification`.
- Style existant : papier chaud, pin, citron, textures, classes `carte`, `display`, `etiquette`. **Conserver ce style partout.**
- Données : **Supabase uniquement** via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- Géolocalisation : `@capacitor/geolocation` (natif Android) + `navigator.geolocation` (web).
- **Interdits** : clé `service_role`, `DATABASE_URL`, nouvelle table de session, Netlify Database.

---

## Objectif

Ajouter une **page de démarrage** à l'URL `/` (ou `/splash`) qui s'affiche **avant** toute autre page. Elle est la première page que l'utilisateur voit à l'ouverture de l'application.

---

## 1. Nouvelle route dans `src/App.tsx` (ou fichier de routage principal)

Ajouter en **première position** dans le `<Routes>` :

```tsx
<Route path="/" element={<Splash />} />
```

Vérifier que la route existante `/rapport/accueil` reste accessible depuis la page Splash.

---

## 2. Nouveau fichier : `src/pages/Splash.tsx`

Créer ce fichier complet. Il doit respecter le style existant (Tailwind, couleurs, textures de l'appli).

### Structure visuelle (de haut en bas) :

```
┌─────────────────────────────────┐
│                                 │
│         [LOGO HSELY]            │  ← logo existant, taille xl (w-40 h-40 minimum)
│           HSELY                 │  ← nom app, grande police display
│    Contrôle terrain             │  ← sous-titre discret
│                                 │
│ ┌─────────────────────────────┐ │
│ │  Installation opérationnelle│ │  ← label de la box
│ │   ○ Oui      ○ Non          │ │  ← deux boutons radio stylisés
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  📍 Localisation            │ │  ← label de la box
│ │  [ Récupérer ma position ]  │ │  ← bouton d'action
│ │  48.85341, 2.34880 (±8 m)   │ │  ← affiché après succès
│ │  12:34:05                   │ │  ← heure de la capture
│ └─────────────────────────────┘ │
│                                 │
│   [ Commencer le contrôle → ]   │  ← bouton principal, désactivé si opérationnelle === null
│                                 │
└─────────────────────────────────┘
```

### Code complet à implémenter :

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { useRapport } from "../context/RapportContext";

export default function Splash() {
  const navigate = useNavigate();
  const { setEtat } = useRapport(); // ou le nom exact du setter dans le contexte

  const [operationnelle, setOperationnelle] = useState<boolean | null>(null);
  const [localisation, setLocalisation] = useState<{
    latitude: number;
    longitude: number;
    precision: number;
    horodatage: string;
  } | null>(null);
  const [gpsEtat, setGpsEtat] = useState<"idle" | "chargement" | "ok" | "erreur">("idle");
  const [gpsErreur, setGpsErreur] = useState<string>("");

  async function recupererPosition() {
    setGpsEtat("chargement");
    setGpsErreur("");
    try {
      let coords: { latitude: number; longitude: number; accuracy: number };
      let ts: number;

      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
          throw new Error("Permission de localisation refusée.");
        }
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        });
        coords = pos.coords;
        ts = pos.timestamp;
      } else {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0,
          })
        );
        coords = pos.coords;
        ts = pos.timestamp;
      }

      const loc = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        precision: Math.round(coords.accuracy),
        horodatage: new Date(ts).toISOString(),
      };
      setLocalisation(loc);
      setGpsEtat("ok");
    } catch (e: unknown) {
      setGpsEtat("erreur");
      if (e instanceof GeolocationPositionError) {
        const msgs: Record<number, string> = {
          1: "Permission de localisation refusée.",
          2: "Position indisponible.",
          3: "Délai dépassé.",
        };
        setGpsErreur(msgs[e.code] ?? "Erreur de géolocalisation.");
      } else if (e instanceof Error) {
        setGpsErreur(e.message);
      } else {
        setGpsErreur("Erreur inconnue.");
      }
    }
  }

  function commencer() {
    if (operationnelle === null) return;
    // Enregistrer dans le contexte global
    setEtat((prev: EtatRapport) => ({ // adapter au type exact du contexte
      ...prev,
      operationnelle,
      localisation,
    }));
    navigate("/rapport/accueil");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-[var(--couleur-papier,#fdf6e3)]">
      {/* Logo + Nom */}
      <div className="flex flex-col items-center gap-3">
        <img
          src="/logo.png"            // ← utiliser le chemin exact du logo dans public/ ou assets/
          alt="Logo HSELY"
          className="w-40 h-40 object-contain"
        />
        <h1 className="display text-5xl font-bold tracking-tight text-[var(--couleur-pin,#2d4a1e)]">
          HSELY
        </h1>
        <p className="etiquette text-sm text-[var(--couleur-citron,#8a7a00)] uppercase tracking-widest">
          Contrôle terrain
        </p>
      </div>

      {/* Box : état opérationnel */}
      <div className="carte w-full max-w-sm rounded-xl border border-[var(--couleur-pin,#2d4a1e)]/20 p-5 flex flex-col gap-3">
        <p className="etiquette text-xs uppercase tracking-wider font-semibold text-[var(--couleur-pin,#2d4a1e)]">
          Installation opérationnelle ?
        </p>
        <div className="flex gap-4">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              onClick={() => setOperationnelle(val)}
              className={[
                "flex-1 py-3 rounded-lg border-2 font-semibold transition-all",
                operationnelle === val
                  ? "border-[var(--couleur-pin,#2d4a1e)] bg-[var(--couleur-pin,#2d4a1e)] text-white"
                  : "border-[var(--couleur-pin,#2d4a1e)]/30 text-[var(--couleur-pin,#2d4a1e)] hover:border-[var(--couleur-pin,#2d4a1e)]/60",
              ].join(" ")}
            >
              {val ? "Oui" : "Non"}
            </button>
          ))}
        </div>
      </div>

      {/* Box : localisation */}
      <div className="carte w-full max-w-sm rounded-xl border border-[var(--couleur-pin,#2d4a1e)]/20 p-5 flex flex-col gap-3">
        <p className="etiquette text-xs uppercase tracking-wider font-semibold text-[var(--couleur-pin,#2d4a1e)]">
          📍 Localisation
        </p>
        <button
          onClick={recupererPosition}
          disabled={gpsEtat === "chargement"}
          className="w-full py-3 rounded-lg border-2 border-[var(--couleur-pin,#2d4a1e)]/40 font-semibold text-[var(--couleur-pin,#2d4a1e)] hover:border-[var(--couleur-pin,#2d4a1e)] disabled:opacity-50 transition-all"
        >
          {gpsEtat === "chargement" ? "Localisation en cours…" : "Récupérer ma position"}
        </button>
        {gpsEtat === "ok" && localisation && (
          <div className="text-sm text-[var(--couleur-pin,#2d4a1e)] space-y-0.5">
            <p className="font-mono">
              {localisation.latitude.toFixed(5)}, {localisation.longitude.toFixed(5)}{" "}
              <span className="text-xs opacity-70">(±{localisation.precision} m)</span>
            </p>
            <p className="text-xs opacity-60">
              {new Date(localisation.horodatage).toLocaleTimeString("fr-FR")}
            </p>
          </div>
        )}
        {gpsEtat === "erreur" && (
          <p className="text-sm text-red-600">{gpsErreur}</p>
        )}
        {gpsEtat === "idle" && (
          <p className="text-xs opacity-50 italic">Optionnel — recommandé pour les rapports terrain.</p>
        )}
      </div>

      {/* Bouton principal */}
      <button
        onClick={commencer}
        disabled={operationnelle === null}
        className={[
          "w-full max-w-sm py-4 rounded-xl font-bold text-lg transition-all",
          operationnelle !== null
            ? "bg-[var(--couleur-pin,#2d4a1e)] text-white hover:opacity-90"
            : "bg-[var(--couleur-pin,#2d4a1e)]/20 text-[var(--couleur-pin,#2d4a1e)]/40 cursor-not-allowed",
        ].join(" ")}
      >
        Commencer le contrôle →
      </button>
    </main>
  );
}
```

---

## 3. Ajustements dans `src/context/RapportContext.tsx`

- S'assurer que `operationnelle: null` et `localisation: null` sont présents dans l'état initial.
- Adapter `setEtat` (ou `setOperationnelle` / `setLocalisation`) pour accepter ces deux champs depuis la page Splash.
- **Ne pas** réinitialiser `operationnelle` et `localisation` dans `reinitialiserControle()` : ces valeurs sont valables pour toute la session.

---

## 4. Persistence de la localisation dans Supabase

La localisation est déjà envoyée via `p_localisation` dans le payload RPC (`src/api/rapport.ts`).  
**Aucune nouvelle table n'est à créer.**  
Vérifier seulement que `p_localisation` est bien inclus dans l'appel RPC existant :

```ts
if (payload.localisation) args.p_localisation = payload.localisation;
```

---

## 5. Redirection depuis `src/pages/Accueil.tsx`

La page `/rapport/accueil` existante **ne doit plus** afficher le logo, le choix opérationnel ni le bouton GPS : ces éléments sont désormais sur la page Splash.  
En haut de `Accueil.tsx`, ajouter la garde de redirection :

```ts
if (etat.operationnelle === null) {
  navigate("/");
  return null;
}
```

---

## 6. Chemin du logo

Trouver le chemin exact du logo dans le dépôt (`public/logo.png`, `src/assets/logo.svg`, etc.) et utiliser ce chemin dans `Splash.tsx`. Si le logo n'existe pas encore :

- Créer `public/logo.png` avec un placeholder SVG 200×200 représentant un badge HSELY, **en attendant** que le vrai logo soit fourni.
- Documenter ce point dans la PR.

---

## 7. Validation avant PR

```bash
npm install
npm run build
npx tsc --noEmit
```

- Vérifier que la route `/` charge `Splash`.
- Vérifier que le bouton « Commencer » reste grisé jusqu'au choix Oui/Non.
- Vérifier que la navigation vers `/rapport/accueil` fonctionne après le choix.

Ne pas committer : `node_modules/`, `dist/`, `.env`, `android/`, `*.keystore`.

---

## Critères d'acceptation

- [ ] La route `/` charge `src/pages/Splash.tsx` en première page.
- [ ] Le logo HSELY s'affiche en taille `w-40 h-40` minimum.
- [ ] Le nom **HSELY** et le sous-titre « Contrôle terrain » sont visibles.
- [ ] Les deux boutons **Oui / Non** sélectionnent `operationnelle` dans l'état local.
- [ ] Le bouton **Commencer** est désactivé tant que `operationnelle === null`.
- [ ] Le bouton **Récupérer ma position** appelle l'API GPS (Capacitor natif ou `navigator.geolocation`).
- [ ] La position s'affiche : coordonnées à 5 décimales, précision en mètres, heure.
- [ ] Les erreurs GPS s'affichent en français.
- [ ] `operationnelle` et `localisation` sont enregistrés dans le contexte Supabase avant la navigation.
- [ ] La page `/rapport/accueil` redirige vers `/` si `operationnelle === null`.
- [ ] `npm run build` et `npx tsc --noEmit` passent sans erreur.
- [ ] La PR résume les fichiers créés/modifiés et les étapes de test.
