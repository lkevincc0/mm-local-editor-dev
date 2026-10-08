describe("PNG export", () => {
  const PANEL_GAP = 28;
  const PANEL_WIDTH = 440;
  const EXPORT_SCALE = 3;

  const dimsOf = (blob: Blob) =>
    new Promise<{width: number; height: number}>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        resolve({width: image.naturalWidth, height: image.naturalHeight});
        URL.revokeObjectURL(url);
      };
      image.onerror = () => reject(new Error("exported PNG failed to decode"));
      image.src = url;
    });

  it("grows the export by exactly the goal-feedback panel, and honours the toggle", () => {
    const goal = {id: 1, instanceId: "1-1", content: "Export goal", type: "Do", children: []};
    const project = {
      id: "png-export-panel",
      name: "PNG export panel",
      treeData: [goal],
      tabData: ["Do", "Be", "Feel", "Concern", "Who"].map((label) => ({
        label, icon: "", rows: label === "Do" ? [goal] : [],
      })),
      // Keyed by the maxgraph cell id the renderer generates for the Do goal.
      feedbacks: [
        {
          id: "fb-1",
          nodeId: "Functional-1-1",
          nodeLabel: "Export goal",
          author: "Ammber Team",
          content: "This goal could use a bit more detail on how it will be achieved.",
          createdAt: "2026-09-03T12:00:00.000Z",
          status: "open",
        },
      ],
      createdAt: 1,
      updatedAt: 2,
    };
    const write = cy.stub().resolves();
    cy.viewport(1440, 1000);
    cy.visit("/projects", {
      onBeforeLoad(win) {
        win.localStorage.setItem("ammber/projects", JSON.stringify([project]));
        win.localStorage.setItem("ammber/ui-theme", '"classic"');
        win.localStorage.setItem("ammber/ui-mode", '"classic"');
        Object.defineProperty(win, "showSaveFilePicker", {
          configurable: true,
          value: async () => ({
            createWritable: async () => ({write, close: async () => undefined}),
          }),
        });
      },
    });
    cy.contains(project.name).click();
    cy.contains("Render Model").click();
    cy.get('[data-cy="graph-canvas"] svg').should("be.visible");
    cy.contains("button", "Share").click();

    let withPanel = {width: 0, height: 0};
    cy.contains("button", /^PNG$/).should("be.enabled").click();
    cy.wrap(write).should("have.been.calledOnce");
    cy.then(async () => {
      const blob = write.firstCall.args[0] as Blob;
      expect(blob.type).to.equal("image/png");
      withPanel = await dimsOf(blob);
      expect(withPanel.width, "export is wider than it is tall").to.be.greaterThan(withPanel.height);
    });

    cy.contains("Include goal feedback?").click();
    cy.contains("button", /^PNG$/).click();
    cy.wrap(write).should("have.been.calledTwice");
    cy.then(async () => {
      const without = await dimsOf(write.secondCall.args[0] as Blob);
      expect(
        withPanel.width - without.width,
        "the panel adds its width plus the gap, at the export's pixel density"
      ).to.equal((PANEL_GAP + PANEL_WIDTH) * EXPORT_SCALE);
      expect(without.height, "without the panel the image is the graph alone")
        .to.be.at.most(withPanel.height);
    });
  });
});
