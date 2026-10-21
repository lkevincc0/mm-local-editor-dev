// The app is deployed as a GitHub Pages project site, e.g.
// https://<user>.github.io/mm-local-editor-dev/, so React Router and the files
// in public/ need to know the deployment subpath. Vite exposes the `base` from
// vite.config.ts as import.meta.env.BASE_URL, which keeps the dev server (root)
// and the production build (repository subpath) in sync automatically — never
// hardcode the repository name again.

// Returns "" for a root deployment and "/repo-name" for a project site.
export const getDeployBase = (): string => {
	const base = import.meta.env.BASE_URL;
	if (!base || base === "/" || base === "./") {
		return "";
	}
	return base.replace(/\/+$/, "");
};

export const getBasename = (): string => getDeployBase() || "/";

// Static assets in public/ must be prefixed with the deploy base, otherwise
// absolute paths like "/papers/x.pdf" resolve against the domain root and break
// when the app is served from a subpath (e.g. GitHub Pages).
export const assetUrl = (path: string): string =>
	`${getDeployBase()}/${path.replace(/^\/+/, "")}`;
