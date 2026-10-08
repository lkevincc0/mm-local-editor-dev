describe("SVG export", () => {
  it("exports the model graph and leaves the overall feedback out", () => {
    const goal = {id: 1, instanceId: "1-1", content: "Export goal", type: "Do", children: []};
    const project = {
      id: "svg-export-regression",
      name: "SVG export regression",
      treeData: [goal],
      tabData: ["Do", "Be", "Feel", "Concern", "Who"].map((label) => ({
        label, icon: "", rows: label === "Do" ? [goal] : [],
      })),
      feedbacks: [],
      overallFeedback: {
        author: "Ammber Team",
        content: "Overall this is a solid starting structure -- try filling in the remaining Be/Feel/Concern/Who goals next.\nSecond paragraph.",
        updatedAt: "2026-09-03T12:00:00.000Z",
      },
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
        // Capture the real export at the OS file-picker boundary.
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
    cy.contains("button", /^SVG$/).should("be.enabled").click();
    cy.wrap(write).should("have.been.calledOnce");
    cy.then(() => {
      const blob = write.firstCall.args[0] as Blob;
      expect(blob.type).to.equal("image/svg+xml;charset=utf-8");
      return blob.text();
    }).then((svgString) => {
      // The overall feedback is in-app only, so nothing of it may reach the
      // file -- not the body text, not the author's avatar.
      expect(svgString, "overall feedback body is not exported")
        .to.not.contain("Overall this is");
      expect(svgString, "overall feedback author is not exported")
        .to.not.contain("Ammber Team");
      // Render the exported file in an isolated document, without app CSS.
      cy.document().then((doc) => {
        const iframe = doc.createElement("iframe");
        iframe.dataset.cy = "export-preview";
        iframe.width = "800";
        iframe.height = "900";
        doc.body.appendChild(iframe);
        const preview = iframe.contentDocument!;
        preview.open();
        preview.write(svgString);
        preview.close();
      });
    });
    cy.get<HTMLIFrameElement>('iframe[data-cy="export-preview"]').should(($frame) => {
      const doc = $frame[0].contentDocument!;
      const svg = doc.querySelector("svg")!;
      expect(svg, "the file is a parseable SVG").to.exist;
      expect(svg.querySelector("parsererror")).to.be.null;
      expect(svg.getAttribute("viewBox"), "viewBox matches the size")
        .to.equal(`0 0 ${svg.getAttribute("width")} ${svg.getAttribute("height")}`);
      expect(svg.textContent, "the model graph is drawn").to.contain("Export");
      // The Do goal is a parallelogram, so it is painted as a path inside the
      // graph group rather than as a rectangle.
      expect(svg.querySelectorAll("g").length, "the graph is placed in a group")
        .to.be.greaterThan(0);
      expect(svg.querySelectorAll("path").length, "the goal shape is painted")
        .to.be.greaterThan(0);
      // Only the background fills the canvas; nothing is painted below the
      // graph any more, which is where the overall-feedback band used to sit.
      const background = svg.querySelector("rect")!;
      expect(background.getAttribute("width")).to.equal("100%");
      expect(background.getAttribute("height")).to.equal("100%");
      expect(svg.viewBox.baseVal.height, "viewBox height matches the image")
        .to.equal(Number(svg.getAttribute("height")));
    });
  });
});
