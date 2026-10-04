# Original Tuniko web release

Run `npm ci` and `npm run web`; preview on127.0.0.1:4173. Build with `npm run build:web`; output dist/web-preview. The public website uses this original application, not the isolated instrumental-sample build.

GitHub Pages serves the gh-pages branch root, with .nojekyll. It cannot run the Vite music middleware or standalone backend. A licensed catalog, provider availability, CORS and physical native background behavior are separate concerns. No credentials should be committed. See README for configuration and current limitations.

The retained build:demo scripts and original instrumental assets are optional development fixtures; they are not the default published app. Historical sample-demo docs/license notices describe those assets only.
