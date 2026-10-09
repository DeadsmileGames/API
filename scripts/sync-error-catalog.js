import { readFile, mkdir, writeFile } from 'node:fs/promises';
const catalog = await readFile(new URL('../src/utils/errorCatalog.json', import.meta.url));
for (const target of ['../../website/src/generated/errors.json', '../../launcher/src/generated/errors.json', '../../launcher/electron/generated/errors.json']) {
  const url = new URL(target, import.meta.url);
  await mkdir(new URL('.', url), { recursive: true });
  await writeFile(url, catalog);
}
await writeFile(new URL('../public/error-catalog.js', import.meta.url), `window.deadsmileErrors = ${catalog.toString().trim()};\n`);
