import { copyFile, mkdir } from 'node:fs/promises';

for (const [directory, names] of [['styles', ['global.css', 'website.css']], ['fonts', ['Berlin-Sans-FB-Demi-Bold.woff2', 'gadugi-bold.woff2']]]) {
  await mkdir(new URL(`../public/${directory}/`, import.meta.url), { recursive: true });
  for (const name of names) await copyFile(new URL(`../../website/src/${directory}/${name}`, import.meta.url), new URL(`../public/${directory}/${name}`, import.meta.url));
}
