figma.showUI(__html__, { width: 340, height: 600 });

figma.ui.onmessage = msg => {
    if (msg.type === 'create-artboard') {
        const { svg, width, height } = msg;

        // Create a frame (artboard)
        const frame = figma.createFrame();
        frame.name = "Turing Pattern";
        frame.resize(width, height);

        // Create vector node from SVG
        const node = figma.createNodeFromSvg(svg);

        // The SVG node from createNodeFromSvg is usually a Frame containing vector paths.
        // We can ungroup it or just place it inside our artboard.
        // Let's place it inside and center it.
        frame.appendChild(node);
        node.x = 0;
        node.y = 0;

        // Select the new frame and zoom to it
        figma.currentPage.selection = [frame];
        figma.viewport.scrollAndZoomIntoView([frame]);
    }

    // We don't close the plugin automatically so the user can generate more patterns
    // figma.closePlugin();
};
