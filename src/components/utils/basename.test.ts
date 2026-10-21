import {afterEach, describe, expect, it, vi} from "vitest";
import {assetUrl, getBasename, getDeployBase} from "./basename";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("getBasename", () => {
    it("uses the GitHub Pages repository subpath from the Vite base", () => {
        vi.stubEnv("BASE_URL", "/mm-local-editor-dev/");

        expect(getDeployBase()).toBe("/mm-local-editor-dev");
        expect(getBasename()).toBe("/mm-local-editor-dev");
    });

    it("uses the root for the dev server and root deployments", () => {
        vi.stubEnv("BASE_URL", "/");

        expect(getDeployBase()).toBe("");
        expect(getBasename()).toBe("/");
    });
});

describe("assetUrl", () => {
    it("prefixes public assets with the deploy subpath", () => {
        vi.stubEnv("BASE_URL", "/mm-local-editor-dev/");

        expect(assetUrl("/img/Cloud.png")).toBe("/mm-local-editor-dev/img/Cloud.png");
        expect(assetUrl("leon.png")).toBe("/mm-local-editor-dev/leon.png");
    });

    it("keeps public assets at the domain root when deployed at the root", () => {
        vi.stubEnv("BASE_URL", "/");

        expect(assetUrl("/img/Cloud.png")).toBe("/img/Cloud.png");
    });
});
