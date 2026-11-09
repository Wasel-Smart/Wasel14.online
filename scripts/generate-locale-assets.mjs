#!/usr/bin/env node

import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const translationsEntry = resolve(projectRoot, 'src/locales/translations.ts');
const outputDirectory = resolve(projectRoot, 'src/locales/languages');

const build = buildSync({
  entryPoints: [translationsEntry],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
});
const bundledTranslations = build.outputFiles[0]?.text;

if (!bundledTranslations) {
  throw new Error('Unable to build locale assets from src/locales/translations.ts');
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'wasel-locale-assets-'));

try {
  const temporaryModule = join(temporaryDirectory, 'translations.cjs');
  writeFileSync(temporaryModule, bundledTranslations, 'utf8');

  const translations = require(temporaryModule).translations;
  if (!translations || typeof translations !== 'object') {
    throw new Error('The translation module does not export a translations object');
  }

  mkdirSync(outputDirectory, { recursive: true });

  for (const language of ['ar', 'en']) {
    const values = translations[language];
    if (!values || typeof values !== 'object') {
      throw new Error(`The translation module has no "${language}" translations`);
    }

    writeFileSync(
      join(outputDirectory, `${language}.json`),
      `${JSON.stringify(values, null, 2)}\n`,
      'utf8',
    );
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
