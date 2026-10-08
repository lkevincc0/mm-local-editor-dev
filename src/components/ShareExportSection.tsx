import React, {useState} from "react";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import {BsFiletypePng, BsFiletypeSvg} from "react-icons/bs";

import ErrorModal, {ErrorModalProps} from "./ErrorModal";
import {useFeedbackContext} from "./context/FeedbackContext";
import {useFileContext} from "./context/FileProvider";
import {useGraph} from "./context/GraphContext";
import {useProjectContext} from "./context/ProjectContext";
import {
    EmbeddedProjectData,
    exportGraphAsPNG,
    exportGraphAsSVG,
    getExportReadiness
} from "./utils/exportGraphImage";

import styles from "./ShareModal.module.css";

type ShareExportSectionProps = {
    showGraphSection: boolean;
};

type ExportToggleProps = {
    label: string;
    hint: string;
    disabled: boolean;
    checked: boolean;
    onChange: (checked: boolean) => void;
};

const ExportToggle: React.FC<ExportToggleProps> = ({
    label,
    hint,
    disabled,
    checked,
    onChange
}) => (
    <label
        className={
            disabled
                ? `${styles.feedbackToggle} ${styles.feedbackToggleDisabled}`
                : styles.feedbackToggle
        }
    >
        <input
            type="checkbox"
            checked={checked && !disabled}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
        />
        <span className={styles.toggleTrack} aria-hidden="true">
            <span className={styles.toggleThumb}/>
        </span>
        <span className={styles.toggleLabel}>
            {label}
            {disabled && <span className={styles.toggleHint}>{hint}</span>}
        </span>
    </label>
);

const ShareExportSection: React.FC<ShareExportSectionProps> = ({
    showGraphSection
}) => {
    const {graph} = useGraph();
    const {cluster, tabData, treeData} = useFileContext();
    const {currentProject} = useProjectContext();
    const {feedbacks, overallFeedback} = useFeedbackContext();

    const [includeNodeFeedback, setIncludeNodeFeedback] = useState(true);
    const [errorModal, setErrorModal] = useState<ErrorModalProps>({
        show: false,
        title: "",
        message: "",
        onHide: () => setErrorModal((prev) => ({...prev, show: false}))
    });

    const {ready, message} = getExportReadiness(showGraphSection, cluster);

    const showReadinessError = () => {
        setErrorModal({
            show: true,
            title: "Cannot Export Model",
            message,
            onHide: () => setErrorModal((prev) => ({...prev, show: false}))
        });
    };

    const buildProjectData = (): EmbeddedProjectData => ({
        name: currentProject?.name,
        feedbacks,
        overallFeedback,
        tabData,
        treeData: treeData || []
    });

    const handleExportPng = () => {
        if (!ready || !graph) {
            showReadinessError();
            return;
        }

        exportGraphAsPNG(graph, {
            projectData: buildProjectData(),
            includeNodeFeedback
        });
    };

    const handleExportSvg = () => {
        if (!ready || !graph) {
            showReadinessError();
            return;
        }

        exportGraphAsSVG(graph, buildProjectData());
    };

    const tooltip = <Tooltip id="export-tooltip">{message}</Tooltip>;

    return (
        <div className={styles.exportSection}>
            <div className={styles.exportHeader}>
                <div>
                    <div className={styles.exportTitle}>
                        Export
                    </div>
                    <div className={styles.exportDescription}>
                        Download the rendered model as an image
                    </div>
                </div>
            </div>

            <ExportToggle
                label="Include goal feedback?"
                hint="Add feedback to a goal first"
                disabled={feedbacks.length === 0}
                checked={includeNodeFeedback}
                onChange={setIncludeNodeFeedback}
            />

            <div className={styles.exportButtons}>
                <OverlayTrigger
                    placement="top"
                    overlay={tooltip}
                    trigger={ready ? [] : ["hover", "focus"]}
                >
                    <span className={styles.exportButtonWrap}>
                        <button
                            type="button"
                            className={styles.exportButton}
                            onClick={handleExportPng}
                            disabled={!ready}
                        >
                            <BsFiletypePng/>
                            PNG
                        </button>
                    </span>
                </OverlayTrigger>

                <OverlayTrigger
                    placement="top"
                    overlay={tooltip}
                    trigger={ready ? [] : ["hover", "focus"]}
                >
                    <span className={styles.exportButtonWrap}>
                        <button
                            type="button"
                            className={styles.exportButton}
                            onClick={handleExportSvg}
                            disabled={!ready}
                        >
                            <BsFiletypeSvg/>
                            SVG
                        </button>
                    </span>
                </OverlayTrigger>
            </div>

            <ErrorModal {...errorModal} />
        </div>
    );
};

export default ShareExportSection;
