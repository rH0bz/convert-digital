import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/*
 * One entry per React-powered section.
 * The key becomes the filename in assets/ — so 'lookbook' is
 * loaded from Liquid as {{ 'lookbook.js' | asset_url }}.
 * Add a line here when you add another React section.
 */
const entryPoints = {
  'lookbook': 'src/lookbook/index.jsx',
};

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints,
  outdir: 'assets',
  bundle: true,
  // assets/ is loaded with a plain <script defer>, not <script type="module">,
  // so the bundle must be a self-contained IIFE.
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('esbuild: watching src/ — assets/ rebuilds on save');
} else {
  await esbuild.build(options);
}
