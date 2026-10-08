import {Graph, ImageExport, SvgCanvas2D} from "@maxgraph/core";
import {Canvg} from "canvg";

import type {Feedback, OverallFeedback, TabContent, TreeGoal} from "../types";
import {InitialTab} from "../../data/initialTabs";
import {returnFocusToGraph} from "./GraphUtils";
import {embedJsonInPng, embedJsonInSvg} from "./imageMetadata";
import {
    FeedbackGroup,
    GraphNodeBounds,
    PNG_FEEDBACK_PANEL_GAP,
    calculateFeedbackPanelLayout,
    calculatePngExportDimensions,
    createGraphToExportPointConverter,
    drawFeedbackNodeBadges,
    drawFeedbackPanel,
    getFeedbackNodeBadges,
    groupFeedbackByNode
} from "./pngFeedbackAnnotations";

import {getThemeTokens} from "./themeTokens";

const PNG_EXPORT_SCALE = 3;
export const EXPORT_PADDING = 24;

type ExportExtension = "png" | "svg";

export const getExportFileName = (
    projectName: string | undefined,
    extension: ExportExtension
): string => {
    const name = (projectName ?? "")
        .trim()
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/[. ]+$/, "")
        .replace(/\.(png|svg)$/i, "")
        .replace(/[. ]+$/, "");

    return `${name || "Graph"}.${extension}`;
};

// Project metadata embedded into exported images so they can be re-imported.
export type EmbeddedProjectData = {
    name?: string;
    feedbacks: Feedback[];
    overallFeedback?: OverallFeedback;
    tabData: TabContent[] | InitialTab[];
    treeData: TreeGoal[];
};

export type ExportReadiness = {
    ready: boolean;
    message: string;
};

// Export is only possible from the Render Model interface with at least one
// functional goal rendered on the canvas.
export const getExportReadiness = (
    showGraphSection: boolean,
    cluster: {ClusterGoals: {GoalType: string}[]}
): ExportReadiness => {
    if (!showGraphSection) {
        return {
            ready: false,
            message:
                "Please click 'Arrange Hierarchy / Render Model' to enable export."
        };
    }

    if (cluster.ClusterGoals.length === 0) {
        return {
            ready: false,
            message: "Please add goals to the hierarchy before exporting."
        };
    }

    if (!cluster.ClusterGoals.some((goal) => goal.GoalType === "Functional")) {
        return {
            ready: false,
            message:
                "Please add at least one functional goal (Do type) to the hierarchy before exporting."
        };
    }

    return {ready: true, message: "Export is ready."};
};

export const serializeGraphSvg = (
    graph: Graph
): {
    svgString: string;
    width: number;
    height: number;
    bounds: GraphNodeBounds;
    scale: number;
} | null => {
    if (!graph?.view?.drawPane) return null;

    const bounds = graph.getGraphBounds();
    const scale = graph.view.scale;
    if (![bounds.x, bounds.y, bounds.width, bounds.height, scale].every(Number.isFinite) ||
        bounds.width <= 0 || bounds.height <= 0 || scale <= 0) return null;

    // Bounds and cell states are in view coordinates. Remove the current zoom
    // and pan so exports contain the full model at its original size.
    const width = Math.ceil(bounds.width / scale) + EXPORT_PADDING * 2;
    const height = Math.ceil(bounds.height / scale) + EXPORT_PADDING * 2;
    const doc = document.implementation.createDocument("http://www.w3.org/2000/svg", "svg", null);
    const svg = doc.documentElement;
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("version", "1.1");

    const background = doc.createElementNS(svg.namespaceURI, "rect");
    background.setAttribute("width", "100%");
    background.setAttribute("height", "100%");
    background.setAttribute("fill", getThemeTokens().graph.canvasBackground);
    svg.appendChild(background);

    const group = doc.createElementNS(svg.namespaceURI, "g");
    svg.appendChild(group);
    const canvas = new SvgCanvas2D(group);
    canvas.scale(1 / scale);
    canvas.translate(
        (width - bounds.width / scale) / 2 - bounds.x / scale,
        EXPORT_PADDING - bounds.y / scale
    );
    // Paint model states only, excluding selection handles and editor overlays.
    new ImageExport().drawState(graph.view.getState(graph.getDataModel().getRoot()), canvas);

    return {
        svgString: new XMLSerializer().serializeToString(svg),
        width,
        height,
        // Callers need the same mapping to place overlays on the exported
        // image, so hand back the bounds the transform above was built from.
        bounds: {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
        },
        scale
    };
};

const saveBlob = async (
    blob: Blob,
    suggestedName: string,
    description: string,
    accept: Record<string, string[]>
) => {
    if ("showSaveFilePicker" in self) {
        const options: SaveFilePickerOptions = {
            id: "exportImage",
            suggestedName,
            startIn: "downloads",
            types: [{description, accept}]
        };
        const handle = await self.showSaveFilePicker(options);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
    }

    // Fallback for non-chromium browsers
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    link.click();
    URL.revokeObjectURL(url);
};

export const exportGraphAsSVG = async (
    graph: Graph,
    projectData: EmbeddedProjectData
): Promise<void> => {
    const serialized = serializeGraphSvg(graph);

    if (!serialized) {
        return;
    }

    // The overall feedback is in-app only; exports carry the model graph and,
    // for the PNG, the goal feedback panel.
    const finalSvg = embedJsonInSvg(serialized.svgString, projectData);

    try {
        await saveBlob(
            new Blob([finalSvg], {type: "image/svg+xml;charset=utf-8"}),
            getExportFileName(projectData.name, "svg"),
            "SVG Image",
            {"image/svg+xml": [".svg"]}
        );
    } catch (error) {
        console.error("Failed to save file: ", error);
    }

    // Return focus to graph container to enable keyboard shortcuts
    returnFocusToGraph();
};

// Node feedback is keyed by the maxgraph cell id, so the panel can reuse
// whatever label the canvas is already showing for that goal.
const resolveNodeLabel = (
    graph: Graph,
    nodeId: string
): string | undefined => {
    const cell = graph.getDataModel().getCell(nodeId);

    if (!cell) {
        return undefined;
    }

    const value = cell.getValue();

    if (typeof value === "string" && value.trim()) {
        return value;
    }

    return graph.getLabel(cell) ?? undefined;
};

const collectFeedbackGroups = (
    graph: Graph,
    feedbacks: Feedback[]
): FeedbackGroup[] => {
    if (feedbacks.length === 0) {
        return [];
    }

    return groupFeedbackByNode(feedbacks, (nodeId) =>
        resolveNodeLabel(graph, nodeId)
    );
};

// Numbers the groups onto the nodes they belong to, so a panel entry can be
// traced back to a goal on the graph.
const drawNodeFeedbackBadges = (
    context: CanvasRenderingContext2D,
    graph: Graph,
    groups: FeedbackGroup[],
    exportBounds: GraphNodeBounds,
    exportScale: number,
    graphWidth: number
): void => {
    const model = graph.getDataModel();
    const convertPoint = createGraphToExportPointConverter(
        exportBounds,
        exportScale,
        graphWidth,
        EXPORT_PADDING
    );

    const badges = getFeedbackNodeBadges(
        groups,
        (nodeId) => {
            const cell = model.getCell(nodeId);
            const state = cell ? graph.getView().getState(cell) : null;

            if (!state) {
                return undefined;
            }

            return {
                x: state.x,
                y: state.y,
                width: state.width,
                height: state.height
            };
        },
        convertPoint
    );

    // The badge ring blends into the graph's own background, which the export
    // paints from the same token.
    drawFeedbackNodeBadges(context, badges, getThemeTokens().graph.canvasBackground);
};

export const exportGraphAsPNG = async (
    graph: Graph,
    options: {
        projectData: EmbeddedProjectData;
        includeNodeFeedback: boolean;
    }
): Promise<void> => {
    const serialized = serializeGraphSvg(graph);

    if (!serialized) {
        return;
    }

    const {
        svgString,
        width: graphWidth,
        height: graphHeight,
        bounds: exportBounds,
        scale: exportScale
    } = serialized;

    // Create a canvas element
    const canvas = document.createElement("canvas");
    // Render at a higher pixel density for a sharper PNG export
    canvas.width = Math.round(graphWidth * PNG_EXPORT_SCALE);
    canvas.height = Math.round(graphHeight * PNG_EXPORT_SCALE);

    const context = canvas.getContext("2d");

    if (!context) {
        console.error("Failed to get canvas context.");
        return;
    }

    context.scale(PNG_EXPORT_SCALE, PNG_EXPORT_SCALE);

    // Use Canvg to render SVG onto the canvas
    const v = Canvg.fromString(context, svgString, {
        ignoreDimensions: true
    });

    // Render SVG onto the canvas
    await v.render();

    const groups = options.includeNodeFeedback
        ? collectFeedbackGroups(graph, options.projectData.feedbacks)
        : [];
    // The graph canvas context already carries the export font metrics, so it
    // measures the panel too.
    const panelLayout =
        groups.length > 0
            ? calculateFeedbackPanelLayout(context, groups)
            : null;

    let exportCanvas = canvas;

    // The goal-feedback panel sits to the right of the graph; with no panel
    // the graph canvas is already the finished image.
    const dimensions = calculatePngExportDimensions(
        graphWidth,
        graphHeight,
        panelLayout
    );

    if (panelLayout) {
        const exportWidth = dimensions.width;
        const exportHeight = dimensions.height;

        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = Math.round(exportWidth * PNG_EXPORT_SCALE);
        finalCanvas.height = Math.round(exportHeight * PNG_EXPORT_SCALE);

        const finalContext = finalCanvas.getContext("2d");

        if (!finalContext) {
            console.error("Failed to get final canvas context.");
            return;
        }

        finalContext.scale(PNG_EXPORT_SCALE, PNG_EXPORT_SCALE);
        finalContext.fillStyle = getThemeTokens().graph.canvasBackground;
        finalContext.fillRect(0, 0, exportWidth, exportHeight);
        finalContext.drawImage(
            canvas,
            0,
            0,
            canvas.width,
            canvas.height,
            0,
            0,
            graphWidth,
            graphHeight
        );

        drawNodeFeedbackBadges(
            finalContext,
            graph,
            groups,
            exportBounds,
            exportScale,
            graphWidth
        );
        drawFeedbackPanel(
            finalContext,
            panelLayout,
            graphWidth + PNG_FEEDBACK_PANEL_GAP,
            dimensions.height
        );

        exportCanvas = finalCanvas;
    }

    // Convert the canvas content to a Blob (PNG format)
    exportCanvas.toBlob(async (blob) => {
        if (blob) {
            try {
                const finalBlob = await embedJsonInPng(blob, options.projectData);
                await saveBlob(finalBlob, getExportFileName(options.projectData.name, "png"), "PNG Image", {
                    "image/png": [".png"]
                });
            } catch (error) {
                console.error("Failed to save file: ", error);
            }
        }
    }, "image/png");

    // Return focus to graph container to enable keyboard shortcuts
    returnFocusToGraph();
};
