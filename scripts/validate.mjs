#!/usr/bin/env node
/**
 * Startet scripts/validate.py mit dem Python, das auf diesem Rechner vorhanden ist.
 *
 * Warum dieser Umweg: Unter Windows heißt Python meist `python`, unter Linux und
 * macOS (und im Vercel-Build) `python3`. Ein fest verdrahteter Name würde auf der
 * jeweils anderen Seite scheitern. Mit `PYTHON=/pfad/zu/python npm run validate`
 * lässt sich ein bestimmter Interpreter erzwingen.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const skript = fileURLToPath(new URL('./validate.py', import.meta.url));

const kandidaten = process.env.PYTHON
  ? [process.env.PYTHON]
  : process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

/**
 * Prüft, ob hinter dem Namen wirklich ein Python 3 steckt, und gibt zurück, ob
 * dafür die Shell gebraucht wird (nötig bei .bat/.cmd-Wrappern unter Windows).
 * Der Windows-Platzhalter `python3` aus dem Microsoft Store fällt hier durch,
 * weil er keine Versionsnummer ausgibt.
 */
function pruefePython3(befehl) {
  for (const shell of [false, true]) {
    const test = spawnSync(befehl, ['--version'], { encoding: 'utf8', shell });
    if (test.error) continue;
    if (/^Python 3\./m.test(`${test.stdout ?? ''}${test.stderr ?? ''}`)) return { befehl, shell };
  }
  return null;
}

let python = null;
for (const kandidat of kandidaten) {
  python = pruefePython3(kandidat);
  if (python) break;
}

if (!python) {
  console.error(
    `\nFEHLER: Kein Python 3 gefunden (gesucht: ${kandidaten.join(', ')}).\n` +
      'Python 3 installieren (https://www.python.org/downloads/) oder den Pfad setzen:\n' +
      '  PYTHON=/pfad/zu/python npm run validate\n',
  );
  process.exit(1);
}

const lauf = spawnSync(python.befehl, [python.shell ? `"${skript}"` : skript], {
  stdio: 'inherit',
  shell: python.shell,
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});

if (lauf.error) {
  console.error(`\nFEHLER: ${python.befehl} konnte nicht gestartet werden: ${lauf.error.message}\n`);
  process.exit(1);
}

if (lauf.status !== 0) {
  console.error(
    '\nDie Datenprüfung ist fehlgeschlagen. Der Build wurde abgebrochen,\n' +
      'damit fehlerhafte Daten nicht veröffentlicht werden.\n' +
      'Fehlt das Paket `jsonschema`? Dann:  pip install -r requirements.txt\n',
  );
}

process.exit(lauf.status ?? 1);
