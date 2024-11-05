import type { Config } from 'tailwindcss';

import { TailwindPreset } from '@ecs-pcl/tailwind';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  presets: [TailwindPreset],
};

export default config;
