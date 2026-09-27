// scripts/test-api.mjs
// Lance : node scripts/test-api.mjs "Bel-Air"
// Affiche les prochains passages bruts pour valider que la source répond bien.

const stop = process.argv[2] ?? "Genève, Bel-Air";
const url = `https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(stop)}&limit=8`;

console.log("→", url, "\n");

const res = await fetch(url);
if (!res.ok) {
  console.error("HTTP", res.status);
  process.exit(1);
}
const data = await res.json();

if (!data.stationboard?.length) {
  console.log("Aucun passage. Vérifie le nom exact via /v1/locations?query=...");
  process.exit(0);
}

for (const e of data.stationboard) {
  const s = e.stop ?? {};
  const rt = s.prognosis?.departure ?? s.departure;
  const min = rt ? Math.round((new Date(rt) - Date.now()) / 60000) : "?";
  const delay = s.delay ? ` (+${s.delay}′)` : "";
  console.log(
    `${(e.number ?? "?").padEnd(5)} → ${(e.to ?? "").padEnd(28)} ${String(min).padStart(3)}′${delay}`
  );
}
