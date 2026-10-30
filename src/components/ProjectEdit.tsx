import React, {useEffect, useState} from "react";

import ProjectEditHeader from "./header/ProjectEditHeader";
import "./ProjectEdit.css";
import SectionPanel from "./SectionPanel";
import CanvasToolbar from "./CanvasToolbar";

import {GraphProvider} from "./context/GraphContext";
import {FeedbackProvider} from "./context/FeedbackContext";
import {useTheme} from "./context/ThemeContext";
import {readStorage, writeStorage} from "./utils/storage";

import ClassicProgressBar, {ClassicStep} from "./classic/ClassicProgressBar";
import ClassicSectionPanel from "./classic/ClassicSectionPanel";

export type PanelDock = "left" | "right";

const PANEL_LAYOUT_STORAGE_KEY = "ammber/editor-panel-layout";

const readPanelDock = (
    panel: "goal" | "hierarchy",
    fallback: PanelDock
): PanelDock => {
    try {
        const saved = JSON.parse(
            readStorage(PANEL_LAYOUT_STORAGE_KEY) ?? "{}"
        ) as Record<string, unknown>;

        return saved[panel] === "left" || saved[panel] === "right"
            ? saved[panel]
            : fallback;
    } catch {
        return fallback;
    }
};

const ProjectEdit: React.FC = () => {
    const {mode} = useTheme();

    const [showGoalSection, setShowGoalSection] = useState(true);
    const [showHierarchySection, setShowHierarchySection] = useState(true);
    const [showGraphSection, setShowGraphSection] = useState(true);
    // The original classic UI had no feedback panel: keep it off by default
    // in classic mode so the canvas gets the full width.
    const [showFeedbackSection, setShowFeedbackSection] = useState(mode !== "classic");

    // Classic mode: which workflow step (goal list+hierarchy vs rendered
    // model) the arrow-steps breadcrumb is on.
    const [classicStep, setClassicStep] = useState<ClassicStep>("goals");

    const [goalDock, setGoalDock] = useState<PanelDock>(() =>
        readPanelDock("goal", "left")
    );

    const [hierarchyDock, setHierarchyDock] = useState<PanelDock>(() =>
        readPanelDock("hierarchy", "right")
    );


    useEffect(() => {
        writeStorage(
            PANEL_LAYOUT_STORAGE_KEY,
            JSON.stringify({
                goal: goalDock,
                hierarchy: hierarchyDock
            })
        );
    }, [goalDock, hierarchyDock]);

    // Reset the feedback panel to the current mode's default when the UI mode
    // is switched at runtime. The useState initializer only runs once, so it
    // would otherwise keep the previous mode's feedback state (e.g. leaving
    // feedback open after switching modern -> classic).
    useEffect(() => {
        setShowFeedbackSection(mode !== "classic");
    }, [mode]);

    if (mode === "classic") {
        const classicShowGoals = classicStep === "goals";
        const classicShowGraph = classicStep === "model";

        return (
            <GraphProvider>
                <FeedbackProvider>
                    <div className="project-edit-shell">
                        <ProjectEditHeader
                            showGoalSection={classicShowGoals}
                            setShowGoalSection={setShowGoalSection}
                            showGraphSection={classicShowGraph}
                        />

                        <ClassicProgressBar
                            activeStep={classicStep}
                            onStepChange={setClassicStep}
                            showFeedbackSection={showFeedbackSection}
                            onToggleFeedback={() =>
                                setShowFeedbackSection(!showFeedbackSection)
                            }
                        />

                        <ClassicSectionPanel
                            showGoalSection={classicShowGoals}
                            showGraphSection={classicShowGraph}
                            showFeedbackSection={showFeedbackSection}
                            onCloseFeedback={() => setShowFeedbackSection(false)}
                            paddingX={20}
                        />
                    </div>
                </FeedbackProvider>
            </GraphProvider>
        );
    }

    return (
        <GraphProvider>
            <FeedbackProvider>
                <div className="project-edit-shell">
                    <ProjectEditHeader
                        showGoalSection={showGoalSection}
                        setShowGoalSection={setShowGoalSection}
                        showGraphSection={showGraphSection}
                    />

                    <CanvasToolbar
                        showGoalSection={showGoalSection}
                        setShowGoalSection={setShowGoalSection}
                        showHierarchySection={showHierarchySection}
                        setShowHierarchySection={setShowHierarchySection}
                        showGraphSection={showGraphSection}
                        setShowGraphSection={setShowGraphSection}
                        showFeedbackSection={showFeedbackSection}
                        setShowFeedbackSection={setShowFeedbackSection}
                    />

                    <SectionPanel
                        showGoalSection={showGoalSection}
                        setShowGoalSection={setShowGoalSection}
                        goalDock={goalDock}
                        setGoalDock={setGoalDock}
                        showHierarchySection={showHierarchySection}
                        setShowHierarchySection={setShowHierarchySection}
                        hierarchyDock={hierarchyDock}
                        setHierarchyDock={setHierarchyDock}
                        showGraphSection={showGraphSection}
                        showFeedbackSection={showFeedbackSection}
                        setShowFeedbackSection={setShowFeedbackSection}
                        paddingX={20}
                    />
                </div>
            </FeedbackProvider>
        </GraphProvider>
    );
};

export default ProjectEdit;
