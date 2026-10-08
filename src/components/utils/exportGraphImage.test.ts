/** @vitest-environment jsdom */
import {Graph} from "@maxgraph/core";
import {afterEach, describe, expect, it} from "vitest";
import {EXPORT_PADDING, serializeGraphSvg} from "./exportGraphImage";
import {
    createGraphToExportPointConverter,
    getFeedbackNodeBadges,
    groupFeedbackByNode
} from "./pngFeedbackAnnotations";

const graphs: Graph[] = [];
const makeGraph = () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const graph = new Graph(container);
    graphs.push(graph);
    const cell = graph.insertVertex(graph.getDefaultParent(), null, "Goal & value", -200, -100, 160, 80);
    graph.insertVertex(graph.getDefaultParent(), null, "Far goal", 900, 600, 160, 80);
    graph.setSelectionCell(cell);
    return graph;
};

afterEach(() => {
    graphs.forEach((graph) => graph.destroy());
    graphs.length = 0;
    document.body.innerHTML = "";
});

describe("SVG export bounds", () => {
    it.each([0.25, 0.5, 2])("exports the entire graph at zoom %s without changing selection", (scale) => {
        const graph = makeGraph();
        const selected = graph.getSelectionCell();
        const original = serializeGraphSvg(graph)!;
        graph.view.scaleAndTranslate(scale, -700, 300);
        const exported = serializeGraphSvg(graph)!;
        expect(exported.width).toBe(original.width);
        expect(exported.height).toBe(original.height);
        const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml");
        const doc = parse(exported.svgString);
        expect(doc.querySelector("parsererror")).toBeNull();
        expect(doc.documentElement.getAttribute("viewBox")).toBe(`0 0 ${exported.width} ${exported.height}`);
        expect(doc.documentElement.getAttribute("width")).toBe(String(exported.width));
        expect(doc.documentElement.textContent).toContain("Goal & value");
        expect(doc.documentElement.textContent).toContain("Far goal");
        const shapes = Array.from(doc.querySelectorAll('rect[stroke]:not([stroke="none"])'));
        expect(shapes).toHaveLength(2);
        expect(shapes.map((shape) => shape.outerHTML))
            .toEqual(Array.from(parse(original.svgString).querySelectorAll('rect[stroke]:not([stroke="none"])'), (shape) => shape.outerHTML));
        shapes.forEach((shape) => {
            const x = Number(shape.getAttribute("x"));
            const y = Number(shape.getAttribute("y"));
            expect(x).toBeGreaterThan(0);
            expect(y).toBeGreaterThan(0);
            expect(x + Number(shape.getAttribute("width"))).toBeLessThan(exported.width);
            expect(y + Number(shape.getAttribute("height"))).toBeLessThan(exported.height);
        });
        expect(graph.getSelectionCell()).toBe(selected);
        expect(graph.view.scale).toBe(scale);
        expect(graph.view.translate.x).toBe(-700);
    });

    it("sizes a small graph to its own bounds, with no room reserved for feedback", () => {
        const graph = new Graph(document.createElement("div"));
        graphs.push(graph);
        graph.insertVertex(graph.getDefaultParent(), null, "Small", 0, 0, 80, 40);
        // 80x40 of content plus the padding on both sides, and nothing else:
        // the overall-feedback band that used to widen small exports is gone.
        expect(serializeGraphSvg(graph)!.width).toBe(
            Math.ceil(graph.getGraphBounds().width / graph.view.scale) +
                EXPORT_PADDING * 2
        );
    });

    it("skips empty graphs", () => {
        const graph = new Graph(document.createElement("div"));
        graphs.push(graph);
        expect(serializeGraphSvg(graph)).toBeNull();
    });
});

describe("PNG node feedback badges", () => {
    // The badge is placed from the same bounds and scale the serializer used to
    // build the export transform, so it must land on the node's exported corner
    // at any zoom. Handing the serializer's own numbers to the converter is what
    // this asserts; the SVG below is the reference the user actually sees.
    it.each([0.5, 1, 2])("keeps badges on their node at zoom %s", (scale) => {
        const graph = new Graph(document.createElement("div"));
        graphs.push(graph);
        const cell = graph.insertVertex(
            graph.getDefaultParent(),
            null,
            "Do1",
            -200,
            -100,
            160,
            80
        );
        graph.view.scaleAndTranslate(scale, -700, 300);

        const exported = serializeGraphSvg(graph)!;
        const doc = new DOMParser().parseFromString(
            exported.svgString,
            "image/svg+xml"
        );
        const node = Array.from(doc.querySelectorAll("rect")).find(
            (rect) => rect.getAttribute("width") === "160"
        )!;
        expect(node).toBeDefined();

        const state = graph.getView().getState(cell)!;
        const [badge] = getFeedbackNodeBadges(
            groupFeedbackByNode([
                {
                    id: "feedback-1",
                    nodeId: cell.id ?? "node-1",
                    author: "Reviewer",
                    content: "Too broad.",
                    createdAt: "2026-09-17T12:00:00.000Z",
                    status: "open"
                }
            ]),
            () => ({
                x: state.x,
                y: state.y,
                width: state.width,
                height: state.height
            }),
            createGraphToExportPointConverter(
                exported.bounds,
                exported.scale,
                exported.width,
                EXPORT_PADDING
            )
        );

        expect(badge.x).toBeCloseTo(Number(node.getAttribute("x")) + 160, 5);
        expect(badge.y).toBeCloseTo(Number(node.getAttribute("y")), 5);
    });
});
