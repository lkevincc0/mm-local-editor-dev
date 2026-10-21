import {copyFileSync} from "node:fs";
import {join} from "node:path";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project sites are served from https://<user>.github.io/<repo>/,
// so the production build must emit absolute URLs that include the repository
// name. Keep this in sync with the repository name, or override it with
// VITE_BASE_PATH (for example VITE_BASE_PATH=/ if the site ever moves to a
// user/org root site). `src/components/utils/basename.ts` reads the value back
// through import.meta.env.BASE_URL, so there is only one source of truth.
const PRODUCTION_BASE = process.env.VITE_BASE_PATH ?? "/mm-local-editor-dev/";

// GitHub Pages has no SPA rewrites: any direct hit on /projects, /papers or a
// shared link returns 404.html. Emitting a copy of index.html there lets React
// Router take over instead of bouncing the visitor to the repository root.
const spaFallback = () => ({
	name: "spa-404-fallback",
	apply: "build" as const,
	closeBundle() {
		const outDir = join(process.cwd(), "dist");
		copyFileSync(join(outDir, "index.html"), join(outDir, "404.html"));
	},
});

// https://vitejs.dev/config/
export default defineConfig(({command, mode}) => {
	// Keep the dev server at http://localhost:5173/ (and Cypress baseUrl) while
	// `vite build` / `vite preview` use the GitHub Pages subpath.
	const isDevServer = command === "serve" && mode === "development";

	return {
		base: isDevServer ? "/" : PRODUCTION_BASE,
		plugins: [react(), spaFallback()],
		css: {
			devSourcemap: true,
		},
		build: {
			outDir: "dist",
		},
		publicDir: "public",
	};
});
