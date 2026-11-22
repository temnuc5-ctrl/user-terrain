# Prompt Copilot — HSELY : APK Android, Capacitor, géolocalisation et Supabase

## Rôle

Tu es un agent de codage GitHub. Applique ces modifications sur une nouvelle branche `feat/hsely-apk-geolocalisation`, puis ouvre une Pull Request. Ne pousse rien directement sur `main`.

## Nom de l'application

Le nom de l'application est **HSELY**, et rien d'autre.

- Aucune occurrence de « Douche », « Douches », « douches » dans le nom, le titre HTML, les métadonnées, le header, la page d'accueil, le footer, le nom Android, le nom du Worker ou les libellés de marque.
- Remplacer les textes de marque existants par **HSELY**.
- Les libellés métier techniques du formulaire (Pomme, Vanne 1, Palette, etc.) et les noms de tables/colonnes Supabase sont le **contrat de données** : ne pas les renommer.

## Contexte du dépôt

- SPA statique **Vite + React + TypeScript + Tailwind v4**.
- Données : **Supabase uniquement**, via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- Photos : **Cloudflare R2 via un Worker** (dossier `worker/`). Pas de Supabase Storage.
- **Interdits** : clé `service_role`, Netlify Database, `DATABASE_URL`, serveur Express, nouvelle table de session.
- Pages : `/rapport/accueil`, `/rapport/secteur`, `/rapport/identification`, `/rapport/verification`.
- Conserver le style (papier chaud, pin, citron, textures, classes `carte`, `display`, `etiquette`).

## Fichiers fournis dans le paquet

Utilise-les tels quels, en adaptant seulement si le dépôt a déjà évolué :

- `capacitor.config.ts`
- `.github/workflows/android-apk.yml`
- `scripts/patch-android.mjs`
- `supabase/PHOTOS.sql`
- `worker/` (Worker HSELY + `wrangler.toml`)

## 1. Renommage HSELY

Modifier au minimum :

- `capacitor.config.ts` : `appName: "HSELY"`, `appId: "com.hsely.app"`.
- `index.html` : `<title>HSELY</title>` et meta description sans « douches ».
- `src/components/Chrome.tsx` : le texte de marque « Douches de sécurité » → **HSELY**.
- `src/pages/Accueil.tsx` : titre principal → **HSELY**, sous-titre orienté « contrôle terrain », footer → `HSELY · v4`.
- `src/pages/Secteur.tsx` : footer → `HSELY · v4` si présent.
- `README.md` : nom HSELY, commandes et URLs.

Ne pas modifier les noms des tables `rapports_lf`, `rapports_nissan`, `rapports_st`, les colonnes, ni les 12 critères.

## 2. `package.json`

Ajouter :

```json
"dependencies": {
  "@capacitor/core": "^7.0.0",
  "@capacitor/android": "^7.0.0",
  "@capacitor/geolocation": "^7.0.0"
},
"devDependencies": {
  "@capacitor/cli": "^7.0.0"
}
```

Ajouter :

```json
"android:add": "cap add android",
"android:sync": "cap sync android",
"apk:debug": "npm run build && (test -d android || cap add android) && cap sync android && node scripts/patch-android.mjs && cd android && ./gradlew assembleDebug"
```

## 3. `capacitor.config.ts`

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hsely.app",
  appName: "HSELY",
  webDir: "dist",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false },
};

export default config;
```

## 4. `.github/workflows/android-apk.yml`

Créer le workflow **Android APK** fourni dans le paquet :

- déclenchement sur `push` vers `main`/`master` et `workflow_dispatch` ;
- Node 22, Java 21, SDK Android 35 ;
- `npm install` puis `npm run build` avec les secrets :
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PHOTOS_ENDPOINT`, `VITE_PHOTOS_TOKEN` ;
- `npx cap add android` si `android/` est absent, puis `npx cap sync android` ;
- `node scripts/patch-android.mjs` ;
- `./gradlew assembleDebug --no-daemon` ;
- upload de l'artefact **`hsely-debug-apk`** (`app-debug.apk`).

Le workflow ne doit jamais committer `android/`, `dist/`, `node_modules/` ou `.env`.

## 5. `scripts/patch-android.mjs`

Créer le script fourni : il ajoute au manifeste Android, si absents :

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
```

Il doit être idempotent et échouer clairement si le manifeste n'existe pas.

## 6. Géolocalisation et données Supabase

### `src/types.ts`

```ts
export interface Localisation {
  latitude: number;
  longitude: number;
  precision: number;   // mètres
  horodatage: string;  // ISO 8601
}
```

Dans `EtatRapport` et `PayloadRapport` :

```ts
operationnelle: boolean | null;
localisation: Localisation | null;
```

### `src/context/RapportContext.tsx`

- initialiser `operationnelle: null`, `localisation: null` ;
- `reinitialiserControle()` ne doit pas effacer ces deux champs (ils valent pour la session).

### `src/api/rapport.ts`

Dans l'appel `rpc("inserer_rapport", args)` :

```ts
if (payload.operationnelle !== null) args.p_operationnelle = payload.operationnelle;
if (payload.localisation) args.p_localisation = payload.localisation;
```

Ne pas envoyer `p_photos` s'il n'y a pas de photo.

### `src/pages/Verification.tsx`

Ajouter au payload :

```ts
operationnelle: etat.operationnelle,
localisation: etat.localisation,
```

Sur la confirmation, afficher :

- `Installation : Opérationnelle / Non opérationnelle`
- `Position : 33.57310, -7.58980 (±12 m)` si présente.

## 7. Page d'accueil et GPS

La page `src/pages/Accueil.tsx` contient déjà :

- logo agrandi + nom **HSELY** ;
- choix obligatoire **Installation opérationnelle ? Oui / Non** ;
- bloc **Localisation** avec « Récupérer ma position » ;
- bouton « Commencer le contrôle » désactivé tant que l'état n'est pas choisi.

Garde dans `Secteur.tsx` : si `etat.operationnelle === null`, rediriger vers `/rapport/accueil`.

### Implémentation GPS

```ts
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
```

- **Natif Android** :
  - `Geolocation.requestPermissions()` ;
  - refuser si ni `location` ni `coarseLocation` ne sont `granted` ;
  - `Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })`.
- **Web** : `navigator.geolocation.getCurrentPosition` avec les mêmes options.
- Enregistrer :
  ```ts
  {
    latitude, longitude,
    precision: coords.accuracy,
    horodatage: new Date(timestamp).toISOString()
  }
  ```
- Messages d'erreur en français : refus, position indisponible, délai dépassé.
- Afficher latitude/longitude à 5 décimales, `±X m` et l'heure.

## 8. `supabase/PHOTOS.sql`

Le fichier fourni est idempotent et doit :

1. Ajouter aux trois tables `rapports_lf`, `rapports_nissan`, `rapports_st` :
   - `photos jsonb not null default '[]'::jsonb`
   - `operationnelle boolean`
   - `localisation jsonb`
2. Supprimer les anciennes signatures 7 et 8 paramètres de `inserer_rapport`.
3. Créer `inserer_rapport` avec **10 paramètres** :
   ```sql
   p_secteur text, p_nom text, p_prenom text, p_unite text, p_emplacement text,
   p_reponses jsonb, p_remarques text,
   p_photos jsonb default '[]'::jsonb,
   p_operationnelle boolean default null,
   p_localisation jsonb default null
   ```
4. Valider `p_reponses` (objet), `p_photos` (tableau ≤ 3), `p_localisation` (objet ou null).
5. Insérer `photos`, `operationnelle`, `localisation`.
6. `grant execute` à `anon` et `service_role`.
7. `notify pgrst, 'reload schema';`
8. Vérifier la fonction 10 paramètres et les trois colonnes.

Conserver les limites anti-abus existantes (1 200/min global, 5/min par rapporteur).

## 9. Worker Cloudflare

Le Worker fourni s'appelle **hsely-photos**, avec le bucket R2 **hsely-photos**.

`cors()` doit accepter une liste séparée par des virgules :

```js
const autorisees = String(env.ALLOWED_ORIGIN || "*")
  .split(",").map((v) => v.trim()).filter(Boolean);
const valeur = autorisees.includes("*")
  ? "*"
  : autorisees.includes(origine) ? origine : autorisees[0] || "*";
```

L'APK Capacitor a pour origine `https://localhost`. Dans `worker/wrangler.toml` ou dans les variables Cloudflare :

```toml
ALLOWED_ORIGIN = "https://votre-site.netlify.app,https://localhost"
```

## 10. `.gitignore` et README

- Ajouter `android/`, `ios/`, `*.keystore`.
- README : section **APK Android** avec secrets GitHub, déclenchement, récupération de l'artefact, build local, debug vs release signée, et la ligne CORS ci-dessus.
- Remplacer toute mention de marque « Douches de sécurité » par **HSELY**.

## Validation avant PR

```bash
npm install
npm run build
npx tsc --noEmit
```

- Vérifier le YAML du workflow.
- Si un SDK Android/Java est disponible : `npx cap add android`, `npx cap sync android`, `node scripts/patch-android.mjs`. Ne pas bloquer si Gradle n'est pas disponible localement ; le workflow s'en charge.

Ne pas committer : `node_modules/`, `dist/`, `.env`, `android/`, `ios/`, `*.keystore`.

## Critères d'acceptation

- [ ] Le nom **HSELY** apparaît partout (titre, header, accueil, APK, artifact), sans « Douches » dans la marque.
- [ ] `npm run build` et `npx tsc --noEmit` passent.
- [ ] Le workflow `Android APK` produit `app-debug.apk` (artefact `hsely-debug-apk`).
- [ ] Le GPS natif demande la permission Android et remplit les coordonnées.
- [ ] Le GPS web utilise `navigator.geolocation`.
- [ ] Le payload RPC contient `p_operationnelle`, `p_localisation`, `p_photos`.
- [ ] La confirmation affiche installation + position + photos.
- [ ] Aucun `service_role`, aucun `DATABASE_URL`, aucune table supplémentaire.
- [ ] Le Worker accepte `https://localhost`.
- [ ] La PR contient un résumé, la liste des fichiers et les étapes de déploiement.
