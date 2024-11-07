import {configs, defineConfig} from '@sadim/eslint';

export default defineConfig(
  ...configs.base,
  ...configs.react,
  ...configs.storybook,
);
