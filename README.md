# HSELY — paquet de modifications

Ce paquet contient le prompt et les fichiers prêts à intégrer au dépôt HSELY.

## Contenu

| Fichier | Rôle |
|---|---|
| `PROMPT-COPILOT.md` | Prompt complet à donner à GitHub Copilot |
| `capacitor.config.ts` | App ID `com.hsely.app`, nom **HSELY** |
| `.github/workflows/android-apk.yml` | Workflow + job `apk` (artifact `hsely-debug-apk`) |
| `scripts/patch-android.mjs` | Permissions GPS du manifeste Android |
| `supabase/PHOTOS.sql` | Colonnes photos / état / GPS + RPC 10 paramètres |
| `worker/` | Worker Cloudflare `hsely-photos` + binding R2 |

## Application

Le nom de l'application est **HSELY**. Aucune mention « Douches » dans le nom,
les titres, les métadonnées ou la marque. Les libellés techniques du formulaire
et les noms de tables/colonnes Supabase restent inchangés (contrat de données).

## Mise en service

1. Copier les fichiers dans le dépôt (ou laisser Copilot appliquer le prompt).
2. Exécuter `supabase/PHOTOS.sql` dans **Supabase → SQL Editor**.
3. Créer le bucket et le Worker :

```bash
cd worker
npx wrangler login
npx wrangler r2 bucket create hsely-photos
npx wrangler secret put APP_TOKEN
npx wrangler deploy
```

4. Dans Netlify / GitHub Actions, renseigner :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PHOTOS_ENDPOINT` (`https://hsely-photos.<compte>.workers.dev`)
   - `VITE_PHOTOS_TOKEN` (même valeur que `APP_TOKEN`)
5. Pousser sur `main` : le workflow **Android APK** produit l'artefact
   `hsely-debug-apk`.

## CORS

Pour que les photos partent aussi depuis l'APK :

```toml
ALLOWED_ORIGIN = "https://votre-site.netlify.app,https://localhost"
```
