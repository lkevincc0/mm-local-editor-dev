/**
 * @vitest-environment jsdom
 */
import {describe, expect, it} from "vitest";

import type {Feedback} from "../types";
import {EXPORT_COLORS, exportAvatarColor, exportAvatarInitial} from "./exportPalette";
import {
    PNG_FEEDBACK_PANEL_GAP,
    PNG_FEEDBACK_PANEL_WIDTH,
    calculateFeedbackPanelLayout,
    calculatePngExportDimensions,
    createGraphToExportPointConverter,
    drawFeedbackNodeBadges,
    drawFeedbackPanel,
    getFeedbackNodeBadges,
    groupFeedbackByNode,
    wrapCanvasText
} from "./pngFeedbackAnnotations";

// Deterministic stand-in for canvas text measurement: 7px per character at
// any font size, which is all these layout functions rely on.
//
// Every paint call also snapshots the colours in force, so a test can assert
// what a shape was filled with rather than just that something was filled.
const createMockContext = () => {
    type Call = {
        method: string;
        args: unknown[];
        fillStyle?: string;
        strokeStyle?: string;
        lineWidth?: number;
    };
    const calls: Call[] = [];

    const ctx = {
        font: "",
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 0,
        textAlign: "",
        textBaseline: "",
        measureText: (text: string) => ({width: text.length * 7}),
        fillText: (...args: unknown[]) => {
            calls.push({
                method: "fillText",
                args,
                fillStyle: ctx.fillStyle
            });
        },
        beginPath: () => {
            calls.push({method: "beginPath", args: []});
        },
        arc: (...args: unknown[]) => {
            calls.push({method: "arc", args});
        },
        moveTo: (...args: unknown[]) => {
            calls.push({method: "moveTo", args});
        },
        lineTo: (...args: unknown[]) => {
            calls.push({method: "lineTo", args});
        },
        arcTo: (...args: unknown[]) => {
            calls.push({method: "arcTo", args});
        },
        closePath: () => {
            calls.push({method: "closePath", args: []});
        },
        fill: () => {
            calls.push({
                method: "fill",
                args: [],
                fillStyle: ctx.fillStyle
            });
        },
        stroke: () => {
            calls.push({
                method: "stroke",
                args: [],
                strokeStyle: ctx.strokeStyle,
                lineWidth: ctx.lineWidth
            });
        },
        fillRect: (...args: unknown[]) => {
            calls.push({
                method: "fillRect",
                args,
                fillStyle: ctx.fillStyle
            });
        },
        strokeRect: (...args: unknown[]) => {
            calls.push({
                method: "strokeRect",
                args,
                strokeStyle: ctx.strokeStyle,
                lineWidth: ctx.lineWidth
            });
        },
        save: () => {
            calls.push({method: "save", args: []});
        },
        restore: () => {
            calls.push({method: "restore", args: []});
        }
    };

    const filled = () =>
        calls.filter((call) => call.fillStyle).map((call) => call.fillStyle);

    return {ctx: ctx as unknown as CanvasRenderingContext2D, calls, filled};
};

const makeFeedback = (overrides: Partial<Feedback> = {}): Feedback => ({
    id: "feedback-1",
    nodeId: "node-1",
    author: "Reviewer",
    content: "This goal is too broad.",
    createdAt: "2026-09-17T12:00:00.000Z",
    status: "open",
    ...overrides
});

describe("groupFeedbackByNode", () => {
    it("groups feedback by node and numbers groups by first appearance", () => {
        const feedbacks = [
            makeFeedback({id: "b", nodeId: "node-2"}),
            makeFeedback({id: "a", nodeId: "node-1"}),
            makeFeedback({id: "c", nodeId: "node-2"})
        ];

        const groups = groupFeedbackByNode(feedbacks);

        expect(groups.map((group) => group.nodeId)).toEqual([
            "node-2",
            "node-1"
        ]);
        expect(groups.map((group) => group.number)).toEqual([1, 2]);
        expect(groups[0].feedbacks.map((feedback) => feedback.id)).toEqual([
            "b",
            "c"
        ]);
    });

    it("prefers the label carried by the feedback over the resolved one", () => {
        const groups = groupFeedbackByNode(
            [makeFeedback({nodeLabel: "Complete a doctoral degree"})],
            () => "label from the graph"
        );

        expect(groups[0].nodeLabel).toBe("Complete a doctoral degree");
    });

    it("falls back to the resolver and then to the node id", () => {
        const resolved = groupFeedbackByNode(
            [makeFeedback({nodeId: "node-7"})],
            () => "  Resolved label  "
        );
        const unresolved = groupFeedbackByNode([makeFeedback({nodeId: "node-7"})]);

        expect(resolved[0].nodeLabel).toBe("Resolved label");
        expect(unresolved[0].nodeLabel).toBe("node-7");
    });
});

describe("wrapCanvasText", () => {
    it("wraps at whitespace without dropping words", () => {
        const {ctx} = createMockContext();
        // 7px per character -> 60px fits 8 characters.
        const lines = wrapCanvasText(ctx, "one two three", 60);

        expect(lines).toEqual(["one two", "three"]);
        expect(lines.join(" ")).toBe("one two three");
        lines.forEach((line) => {
            expect(ctx.measureText(line).width).toBeLessThanOrEqual(60);
        });
    });

    it("splits a token that is wider than the line", () => {
        const {ctx} = createMockContext();
        const lines = wrapCanvasText(ctx, "abcdefghij", 30);

        expect(lines).toEqual(["abcd", "efgh", "ij"]);
    });

    it("splits unspaced CJK text by code point", () => {
        const {ctx} = createMockContext();
        const lines = wrapCanvasText(ctx, "研究动机", 21);

        expect(lines).toEqual(["研究动", "机"]);
    });

    it("keeps explicit line breaks", () => {
        const {ctx} = createMockContext();
        expect(wrapCanvasText(ctx, "a\n\nb", 1000)).toEqual(["a", "", "b"]);
    });
});

describe("calculateFeedbackPanelLayout", () => {
    it("lays out one card per feedback and counts them", () => {
        const {ctx} = createMockContext();
        const groups = groupFeedbackByNode([
            makeFeedback({id: "a", nodeId: "node-1"}),
            makeFeedback({id: "b", nodeId: "node-1"}),
            makeFeedback({id: "c", nodeId: "node-2"})
        ]);

        const layout = calculateFeedbackPanelLayout(ctx, groups);

        expect(layout.width).toBe(PNG_FEEDBACK_PANEL_WIDTH);
        expect(layout.feedbackCount).toBe(3);
        expect(layout.groups).toHaveLength(2);
        expect(layout.groups[0].cards).toHaveLength(2);
        expect(layout.groups[1].cards).toHaveLength(1);
    });

    it("gives every card a positive height inside the panel", () => {
        const {ctx} = createMockContext();
        const layout = calculateFeedbackPanelLayout(
            ctx,
            groupFeedbackByNode([makeFeedback()])
        );
        const cards = layout.groups.flatMap((group) => group.cards);

        cards.forEach((card) => {
            expect(card.height).toBeGreaterThan(0);
        });
        expect(cards[0].top + cards[0].height).toBeLessThanOrEqual(layout.height);
    });

    it("grows the panel when the feedback wraps over more lines", () => {
        const {ctx} = createMockContext();
        const shortPanel = calculateFeedbackPanelLayout(
            ctx,
            groupFeedbackByNode([makeFeedback({content: "Short."})])
        );
        const longPanel = calculateFeedbackPanelLayout(
            ctx,
            groupFeedbackByNode([
                makeFeedback({
                    content:
                        "A much longer piece of feedback that has to wrap across several lines before it is done."
                })
            ])
        );

        expect(longPanel.height).toBeGreaterThan(shortPanel.height);
    });

    it("reserves room for the replies attached to a feedback", () => {
        const {ctx} = createMockContext();
        const withoutReplies = calculateFeedbackPanelLayout(
            ctx,
            groupFeedbackByNode([makeFeedback()])
        );
        const withReplies = calculateFeedbackPanelLayout(
            ctx,
            groupFeedbackByNode([
                makeFeedback({
                    replies: [
                        {
                            id: "reply-1",
                            author: "Jinbao Liu",
                            content: "Agreed, restructuring this branch.",
                            createdAt: "2026-09-17T12:05:00.000Z"
                        }
                    ]
                })
            ])
        );

        expect(withReplies.height).toBeGreaterThan(withoutReplies.height);
    });
});

describe("calculatePngExportDimensions", () => {
    it("leaves the graph size alone when there is no panel", () => {
        expect(calculatePngExportDimensions(800, 600, null)).toEqual({
            width: 800,
            height: 600,
            hasFeedbackPanel: false
        });
    });

    it("places the panel beside the graph", () => {
        const {ctx} = createMockContext();
        const panelLayout = calculateFeedbackPanelLayout(
            ctx,
            groupFeedbackByNode([makeFeedback()])
        );

        const dimensions = calculatePngExportDimensions(800, 200, panelLayout);

        expect(dimensions.width).toBe(
            800 + PNG_FEEDBACK_PANEL_GAP + panelLayout.width
        );
        expect(dimensions.height).toBe(panelLayout.height);
        expect(dimensions.hasFeedbackPanel).toBe(true);
    });

    it("keeps the graph height when the panel is shorter", () => {
        const {ctx} = createMockContext();
        const panelLayout = calculateFeedbackPanelLayout(
            ctx,
            groupFeedbackByNode([makeFeedback()])
        );

        const dimensions = calculatePngExportDimensions(800, 4000, panelLayout);

        expect(dimensions.height).toBe(4000);
    });
});

describe("getFeedbackNodeBadges", () => {
    const bounds = {x: 100, y: 50, width: 200, height: 80};

    it("anchors each badge to the top-right corner of its node", () => {
        const groups = groupFeedbackByNode([
            makeFeedback({nodeId: "node-1"}),
            makeFeedback({nodeId: "node-2"})
        ]);

        const badges = getFeedbackNodeBadges(groups, () => bounds);

        expect(badges).toEqual([
            {number: 1, x: 300, y: 50},
            {number: 2, x: 300, y: 50}
        ]);
    });

    it("skips feedback whose node is not on the canvas", () => {
        const groups = groupFeedbackByNode([
            makeFeedback({nodeId: "node-1"}),
            makeFeedback({nodeId: "node-missing"})
        ]);

        const badges = getFeedbackNodeBadges(groups, (nodeId) =>
            nodeId === "node-missing" ? null : bounds
        );

        expect(badges).toHaveLength(1);
        expect(badges[0].number).toBe(1);
    });

    it("maps node coordinates through the converter", () => {
        const groups = groupFeedbackByNode([makeFeedback({nodeId: "node-1"})]);

        const badges = getFeedbackNodeBadges(
            groups,
            () => bounds,
            (point) => ({x: point.x * 2, y: point.y + 10})
        );

        expect(badges).toEqual([{number: 1, x: 600, y: 60}]);
    });
});

describe("drawing", () => {
    const renderPanel = (feedbacks: Partial<Feedback>[]) => {
        const {ctx, calls, filled} = createMockContext();
        const layout = calculateFeedbackPanelLayout(
            ctx,
            groupFeedbackByNode(feedbacks.map((feedback) => makeFeedback(feedback)))
        );

        drawFeedbackPanel(ctx, layout, 824, 600);

        return {ctx, calls, filled, layout};
    };

    const drawnTexts = (calls: {method: string; args: unknown[]}[]) =>
        calls
            .filter((call) => call.method === "fillText")
            .map((call) => call.args[0]);

    it("draws one numbered badge per node, ringed in the graph's colour", () => {
        const {ctx, calls} = createMockContext();

        drawFeedbackNodeBadges(
            ctx,
            [
                {number: 1, x: 10, y: 20},
                {number: 2, x: 30, y: 40}
            ],
            "#ff0000"
        );

        expect(drawnTexts(calls)).toEqual(["1", "2"]);
        // A disc plus a ring for each badge.
        expect(calls.filter((call) => call.method === "arc")).toHaveLength(4);
        expect(ctx.strokeStyle).toBe("#ff0000");
        expect(ctx.lineWidth).toBe(2.5);
    });

    it("paints the panel background and its header at the requested offset", () => {
        const {calls, layout} = renderPanel([{}]);

        const panelRect = calls.find(
            (call) => call.method === "fillRect" && call.args[0] === 824
        );
        expect(panelRect?.args).toEqual([824, 0, layout.width, 600]);

        const texts = drawnTexts(calls);
        expect(texts).toContain("Goal feedback");
        // The eyebrow is drawn one character at a time to control tracking.
        expect(texts.join("")).toContain("REVIEW");
        expect(texts).toContain(layout.meta);
    });

    it("labels each goal section with its number and goal name", () => {
        const {calls} = renderPanel([{nodeLabel: "Do1"}]);

        const texts = drawnTexts(calls);
        expect(texts).toContain("Do1");
        expect(texts).toContain("1");
    });

    it("marks each comment with a status pill in its own colour", () => {
        expect(renderPanel([{status: "open"}]).filled()).toContain(
            EXPORT_COLORS.openBackground
        );
        expect(renderPanel([{status: "resolved"}]).filled()).toContain(
            EXPORT_COLORS.resolvedBackground
        );
    });

    it("gives the author a disc in their own colour and initial", () => {
        const {calls, filled} = renderPanel([{author: "Zecheng"}]);

        expect(filled()).toContain(exportAvatarColor("Zecheng"));
        expect(drawnTexts(calls)).toContain(exportAvatarInitial("Zecheng"));
    });

    it.each(["1970-01-01T00:00:00.000Z", "", "not-a-date"])(
        "leaves the date off a comment stamped %s",
        (createdAt) => {
            expect(renderPanel([{createdAt}]).layout.groups[0].cards[0].date).toBe(
                ""
            );
        }
    );
});

describe("createGraphToExportPointConverter", () => {
    // bounds 400x200 at view scale 2 -> a 200x100 export plus 24px padding.
    const bounds = {x: 100, y: 50, width: 400, height: 200};
    const convert = createGraphToExportPointConverter(bounds, 2, 248, 24);

    it("places the graph origin one padding step in from the top-left", () => {
        expect(convert({x: 100, y: 50})).toEqual({x: 24, y: 24});
    });

    it("scales cell coordinates down by the current view zoom", () => {
        expect(convert({x: 500, y: 250})).toEqual({x: 224, y: 124});
    });

    it("centres the graph when the export is wider than the graph", () => {
        const wide = createGraphToExportPointConverter(bounds, 2, 348, 24);

        expect(wide({x: 100, y: 50})).toEqual({x: 74, y: 24});
        expect(wide({x: 500, y: 250})).toEqual({x: 274, y: 124});
    });

    it.each([
        ["a zero view scale", {...bounds}, 0, 248, 24],
        ["a non-finite bound", {x: Number.NaN, y: 50, width: 400, height: 200}, 2, 248, 24],
        ["a non-finite export width", {...bounds}, 2, Number.NaN, 24]
    ])("falls back to identity coordinates for %s", (_label, b, scale, width, padding) => {
        const fallback = createGraphToExportPointConverter(b, scale, width, padding);

        expect(fallback({x: 500, y: 250})).toEqual({x: 500, y: 250});
    });
});
