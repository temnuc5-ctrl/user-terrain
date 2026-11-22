#!/usr/bin/env node
/**
 * Complète le manifeste Android généré par `cap add android` (HSELY).
 * Idempotent : peut être relancé sans dupliquer les permissions.
 */
import fs from "node:fs";

const chemin = "android/app/src/main/AndroidManifest.xml";
if (!fs.existsSync(chemin)) {
  console.log("Manifeste Android absent — lancez d'abord `npx cap add android`.");
  process.exit(1);
}

let xml = fs.readFileSync(chemin, "utf8");
const ajouts = [];

for (const permission of [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
]) {
  if (!xml.includes(permission)) {
    ajouts.push(`<uses-permission android:name="${permission}" />`);
  }
}

if (!xml.includes("android.hardware.location.gps")) {
  ajouts.push('    <uses-feature android:name="android.hardware.location.gps" android:required="false" />');
}

if (ajouts.length) {
  xml = xml.replace(/([ \t]*)<application/, (_match, indent) => {
    const lignes = ajouts.map((ligne) => `${indent}${ligne.trim()}`).join("\n");
    return `${lignes}\n\n${indent}<application`;
  });
  fs.writeFileSync(chemin, xml);
  console.log(`Manifeste Android HSELY complété (${ajouts.length} ligne(s)).`);
} else {
  console.log("Manifeste Android déjà à jour.");
}
