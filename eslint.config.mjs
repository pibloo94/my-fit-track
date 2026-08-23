import {
  ignores,
  looseFilesConfig,
  prettierConfig,
  typescriptConfig,
} from '@my-fit-track/config/eslint';
import { boundariesConfig, purityConfigs } from './eslint.boundaries.mjs';

export default [
  { ignores },
  ...typescriptConfig(import.meta.dirname),
  boundariesConfig,
  ...purityConfigs,
  ...looseFilesConfig,
  prettierConfig,
];
