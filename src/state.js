import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from './config.js';
import { log } from './logger.js';

export const readState = async () => {
  try {
    return JSON.parse(await readFile(config.stateFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') log.warn(`Could not read ${config.stateFile}: ${error.message}`);
    return {};
  }
};

export const writeState = async (state) => {
  await mkdir(dirname(config.stateFile), { recursive: true });
  const temporary = `${config.stateFile}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporary, config.stateFile);
};
