// Palette, type stack and avatar helpers for the exported SVG/PNG artifacts
// (the goal-feedback panel in pngFeedbackAnnotations.ts).
//
// These are deliberately fixed export-artifact colors (the modern palette)
// rather than tokens read from the active theme, so an exported image looks
// the same whichever theme produced it.

export const EXPORT_FONT_FAMILY =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export const EXPORT_COLORS = {
    paper: "#f7f6f0",
    surface: "#ffffff",
    ink: "#11110f",
    body: "#383630",
    muted: "#6d6c66",
    eyebrow: "#77736b",
    line: "#deddd6",
    accent: "#6b51c9",
    accentSoft: "#ece7f9",
    openText: "#6f5b8a",
    openBackground: "#f0edf5",
    resolvedText: "#5f6d57",
    resolvedBackground: "#eef2eb",
    replyBackground: "#f6f4ef",
    replyRule: "#e0dce6",
    bubbleFill: "#f4f3ee",
    white: "#ffffff",
    // Shadows are RGBA because they are washed over whatever is underneath.
    cardShadow: "rgba(42, 40, 35, 0.06)",
    badgeShadow: "rgba(37, 33, 62, 0.22)"
};

export const EXPORT_AVATAR_COLORS = [
    "#6b51c9",
    "#b7771e",
    "#397052",
    "#9f352d",
    "#2c6e9e",
    "#71486d"
];

const hashString = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
};

// Deterministic so the same author keeps the same disc across exports.
export const exportAvatarColor = (author: string): string =>
    EXPORT_AVATAR_COLORS[hashString(author.trim()) % EXPORT_AVATAR_COLORS.length];

export const exportAvatarInitial = (author: string): string =>
    (author.trim().charAt(0) || "?").toUpperCase();

// Canvas shadows are painted in device space, so a blur tuned for a 1x
// preview has to be scaled up when the export draws under a pixel-density
// transform. Everything else (line widths, radii) scales with the context.
export const getContextScale = (context: CanvasRenderingContext2D): number => {
    if (typeof context.getTransform !== "function") {
        return 1;
    }

    const scale = context.getTransform().a;

    return Number.isFinite(scale) && scale > 0 ? scale : 1;
};
