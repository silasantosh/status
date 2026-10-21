# Build variants (2026-10-21)

The repo holds the in-collab variant as canonical. Per-site preview builds:

1. Copy `passkey.mjs`, `_worker.js` and this note's sibling files into a variant dir.
2. Regenerate `data.mjs` from the site's Tracker sheet (tab "Tracker"), same mapping
   as the collab generator (see smoke-notes.md); key under `sites["<site>"]`.
3. `sed -i "s/|| 'in-collab'/|| '<site>'/" passkey.mjs`
4. Swap brand colors in the branded 404 block: in-collab #00695C/#153D35/#F0FAF7;
   in-media #4A2164/#361745/#f6edfa (take live values from the site's tracker/index.html).
5. Bundle: `esbuild _worker.js --bundle --format=esm --target=es2022 --outfile=_worker.bundled.js`
6. Deploy dir = live site pack with `_worker.js` replaced by the bundle; deploy as a
   PREVIEW branch (never production without his OK).
