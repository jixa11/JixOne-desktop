import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
const external = ['electron', 'jsdom', 'youtubei.js', 'bgutils-js'];
await build({ entryPoints: ['src/main/main.ts'], outfile: 'dist/main.js', bundle: true, platform: 'node', format: 'cjs', target: 'node20', external, logLevel: 'warning' });
await build({ entryPoints: ['src/main/preload.ts'], outfile: 'dist/preload.js', bundle: true, platform: 'node', format: 'cjs', external: ['electron'], logLevel: 'warning' });
await build({ entryPoints: ['src/renderer/main.tsx'], outfile: 'dist/renderer.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome120', jsx: 'automatic', minify: true, logLevel: 'warning', define: { 'process.env.NODE_ENV': '"production"' } });
cpSync('src/renderer/index.html', 'dist/index.html');
cpSync('src/renderer/styles.css', 'dist/styles.css');
mkdirSync('dist/fonts', { recursive: true });
cpSync('node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2', 'dist/fonts/Vazirmatn[wght].woff2');
