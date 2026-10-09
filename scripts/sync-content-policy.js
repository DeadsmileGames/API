import { copyFile, mkdir } from 'node:fs/promises';

const source = new URL('../src/utils/contentPolicy.js', import.meta.url);
for (const project of ['website']) {
  const directory = new URL(`../../${project}/src/generated/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  await copyFile(source, new URL('contentPolicy.js', directory));
}
