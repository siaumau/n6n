document.addEventListener('DOMContentLoaded', function() {
    // Workflow data store
    const workflowData = {
        nodes: [],
        connections: [],
        nextNodeId: 1,
        startNodeId: null // Track the designated start node
    };

    // DOM Elements
    const canvas = document.getElementById('workflow-canvas');
    const contextMenu = document.getElementById('node-context-menu');
    const nodeSelector = document.getElementById('node-selector');
    const exportButton = document.getElementById('export-button');
    const exportModal = document.getElementById('export-modal');
    const exportTextarea = document.getElementById('export-textarea');
    const closeExportModalBtn = document.querySelector('.close-export-modal');
    const copyExportJsonBtn = document.getElementById('copy-export-json');
    const nodeSearchInput = document.getElementById('node-search');

    // Node Settings Modal Elements (Added)
    const settingsModal = document.getElementById('node-settings-modal');
    const settingsModalContent = settingsModal.querySelector('.modal-content');
    const closeSettingsModalBtn = settingsModal.querySelector('.close-settings-modal');
    const nodeSettingNameInput = document.getElementById('node-setting-name');
    const nodeSettingNotesInput = document.getElementById('node-setting-notes');
    const typeSpecificSettingsContainer = document.getElementById('type-specific-settings');
    const saveSettingsBtn = document.getElementById('save-node-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-node-settings-btn');
    const testHttpRequestBtn = document.getElementById('test-http-request-btn');
    const httpTestResultPre = document.getElementById('http-test-result');
    const nodeSettingHttpUrlInput = document.getElementById('node-setting-http-url');
    const nodeSettingHttpMethodSelect = document.getElementById('node-setting-http-method');
    const nodeSettingHttpHeadersTextarea = document.getElementById('node-setting-http-headers');
    const nodeSettingHttpBodyTextarea = document.getElementById('node-setting-http-body');

    // State variables
    let canvasOffset = { x: 0, y: 0 };
    let isDraggingNode = false;
    let draggedNodeElement = null;
    let dragStartOffset = { x: 0, y: 0 };

    let isConnecting = false;
    let connectionStartPointElement = null; // The output point element where connection starts
    let tempConnectionLineSvg = null; // The temporary SVG line element
    let currentHoveredInputPoint = null; // The input point currently highlighted for snapping

    // --- Initialization ---

    function initializeApp() {
        updateCanvasOffset();
        initCanvasEvents();
        initUIEvents();
        // Load workflow if needed (e.g., from localStorage)
        // loadWorkflow();
        renderWorkflow(); // Initial render if loading data
        console.log("Workflow Tool Initialized");
    }

    function updateCanvasOffset() {
        const rect = canvas.getBoundingClientRect();
        canvasOffset = { x: rect.left, y: rect.top };
    }

    // --- Canvas Event Handling ---

    function initCanvasEvents() {
        canvas.addEventListener('mousedown', handleCanvasMouseDown);
        canvas.addEventListener('mousemove', handleCanvasMouseMove);
        canvas.addEventListener('mouseup', handleCanvasMouseUp);
        canvas.addEventListener('contextmenu', handleCanvasContextMenu);
        canvas.addEventListener('click', handleCanvasClick); // For hiding context menu
        window.addEventListener('resize', updateCanvasOffset); // Recalculate offset on resize
    }

    function handleCanvasMouseDown(e) {
        // Potential future use: Panning the canvas
        // For now, mainly ensures clicks on canvas background hide menus
        hideContextMenu();
        if (isConnecting) {
             // If mouse down on canvas while connecting, cancel it
             // (unless mouseup handles it - this might be redundant)
             // cancelConnection();
        }
    }

    function handleCanvasMouseMove(e) {
        if (isDraggingNode && draggedNodeElement) {
            // Calculate new position relative to canvas origin
            const x = e.clientX - canvasOffset.x - dragStartOffset.x;
            const y = e.clientY - canvasOffset.y - dragStartOffset.y;

            // Move the node element visually
            draggedNodeElement.style.left = `${x}px`;
            draggedNodeElement.style.top = `${y}px`;

            // Update connections attached to this node in real-time
            updateConnectionsForNode(parseInt(draggedNodeElement.dataset.id));

        } else if (isConnecting && connectionStartPointElement && tempConnectionLineSvg) {
            updateTemporaryLine(e);
            handleConnectionSnapping(e);
        }
    }

     function handleCanvasMouseUp(e) {
        // Stop Node Dragging
        if (isDraggingNode) {
            const nodeId = parseInt(draggedNodeElement.dataset.id);
            const nodeData = findNodeData(nodeId);
            if (nodeData) {
                // Final position update in data model
                const finalX = parseFloat(draggedNodeElement.style.left);
                const finalY = parseFloat(draggedNodeElement.style.top);
                nodeData.position = { x: finalX, y: finalY };
                console.log(`Node ${nodeId} moved to`, nodeData.position);
                updateConnectionsForNode(nodeId); // Ensure final update
            }
            draggedNodeElement.classList.remove('dragging'); // Optional: style for dragging node
            isDraggingNode = false;
            draggedNodeElement = null;
        }

        // Finalize or Cancel Connection
        if (isConnecting) {
            finalizeConnection(e);
        }
     }

    function handleCanvasContextMenu(e) {
        e.preventDefault();
        hideContextMenu(); // Hide any previous menu
         // Show Node Selector ONLY if clicking empty canvas space
         // Check if the direct target is the canvas itself
         if (e.target === canvas) {
             showNodeSelector(e.clientX, e.clientY);
         }
    }

     function handleCanvasClick(e) {
        // Hide context menu if clicking anywhere on canvas background
        if (e.target === canvas) {
            hideContextMenu();
        }
        // Note: Clicking on lines to delete is handled by listeners on the lines themselves
    }


    // --- UI Event Handling ---

    function initUIEvents() {
        // Add Node Button
        document.querySelector('.add-btn').addEventListener('click', () => {
            showNodeSelector(null, null, true); // Center the selector
        });

        // Close Node Selector
        nodeSelector.querySelector('.close-btn').addEventListener('click', hideNodeSelector);

        // Node Selection Items
        document.querySelectorAll('.node-selector .node-select-item').forEach(item => {
            item.addEventListener('click', function() {
                const nodeType = this.dataset.type;
                // Position new node near where selector was opened, or center if button used
                const selectorRect = nodeSelector.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                let initialX = (selectorRect.left - canvasRect.left + selectorRect.width / 2);
                let initialY = (selectorRect.top - canvasRect.top + 50); // Slightly below

                // If opened via Add button (centered), place in canvas center
                 if (nodeSelector.dataset.centered === 'true') {
                     initialX = canvas.clientWidth / 2 - 90; // Approx node width / 2
                     initialY = canvas.clientHeight / 2 - 40; // Approx node height / 2
                 }

                // Ensure node is within canvas bounds (simple check)
                 initialX = Math.max(0, Math.min(initialX, canvas.clientWidth - 180));
                 initialY = Math.max(0, Math.min(initialY, canvas.clientHeight - 80));


                addNode(nodeType, initialX, initialY);
                hideNodeSelector();
            });
        });

        // Node Search Filter
        nodeSearchInput.addEventListener('input', filterNodeSelector);

        // Export Button
        exportButton.addEventListener('click', showExportModal);
        closeExportModalBtn.addEventListener('click', hideExportModal);
        copyExportJsonBtn.addEventListener('click', copyExportJsonToClipboard);

        // Settings Modal Buttons (Added)
        closeSettingsModalBtn.addEventListener('click', hideNodeSettingsModal);
        cancelSettingsBtn.addEventListener('click', hideNodeSettingsModal);
        saveSettingsBtn.addEventListener('click', saveNodeSettings);
        testHttpRequestBtn.addEventListener('click', testHttpRequest);

        // Hide context menu on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideContextMenu();
                hideNodeSelector();
                if (isConnecting) cancelConnection(); // Cancel connection on escape
                hideExportModal();
            }
        });

         // Prevent context menu on the custom one
         contextMenu.addEventListener('contextmenu', e => e.preventDefault());
    }

    // --- Node Management ---

    /**
     * Adds a node to the workflow data and renders it on the canvas.
     * @param {string} type - The type of the node (e.g., 'webhook', 'mysql').
     * @param {number} x - The initial X position.
     * @param {number} y - The initial Y position.
     * @returns {object} The added node data object.
     */
    function addNode(type, x, y) {
        const nodeId = workflowData.nextNodeId++;
        const nodeData = {
            id: nodeId,
            type: type,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nodeId}`, // Default name
            position: { x, y },
            parameters: {}, // Placeholder for node-specific settings
            notes: ''       // Placeholder for user notes
            // Add other n8n relevant fields if needed immediately
        };

        workflowData.nodes.push(nodeData);
        renderNode(nodeData); // Render the new node

        console.log(`Node added: ${nodeData.name} (ID: ${nodeId}) at (${x}, ${y})`);
        return nodeData;
    }

     /**
     * Renders a single node element on the canvas based on its data.
     * @param {object} nodeData - The data object for the node.
     */
    function renderNode(nodeData) {
         // Remove existing element if re-rendering
         const existingEl = document.querySelector(`.node-wrapper[data-id="${nodeData.id}"]`);
         if (existingEl) existingEl.remove();

         const nodeWrapper = document.createElement('div');
         nodeWrapper.className = 'node-wrapper no-select'; // Add no-select
         nodeWrapper.style.left = `${nodeData.position.x}px`;
         nodeWrapper.style.top = `${nodeData.position.y}px`;
         nodeWrapper.dataset.id = nodeData.id;

         // --- Determine Icon and Color ---
         let iconClass = 'fas fa-cog'; // Default
         let nodeColor = '#777'; // Default color
         const nodeType = nodeData.type.toLowerCase();

         // Simple mapping (expand as needed from CSS)
         const typeMap = {
             webhook: { icon: 'fa-bolt', color: '#ff7043' },
             schedule: { icon: 'fa-clock', color: '#8e44ad' },
             manual: { icon: 'fa-play', color: '#3498db' },
             mysql: { icon: 'fa-database', color: '#00758f' },
             postgres: { icon: 'fa-database', color: '#336791' },
             sqlite: { icon: 'fa-database', color: '#003b57' },
             datetime: { icon: 'fa-calendar-alt', color: '#4caf50' },
             function: { icon: 'fa-code', color: '#f39c12' },
             set: { icon: 'fa-sliders-h', color: '#1abc9c' },
             if: { icon: 'fa-code-branch', color: '#e74c3c' },
             email: { icon: 'fa-envelope', color: '#3498db' },
             http: { icon: 'fa-globe', color: '#2ecc71' },
         };
         if (typeMap[nodeType]) {
             iconClass = `fas ${typeMap[nodeType].icon}`;
             nodeColor = typeMap[nodeType].color;
         }

         // --- Create Node HTML ---
         nodeWrapper.innerHTML = `
            <div class="node" data-type="${nodeType}">
                <div class="node-header">
                    <div class="node-icon" style="background-color: ${nodeColor};">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="node-title">${nodeData.name}</div>
                </div>
                <div class="node-content">
                   ${nodeData.notes || ''} <!-- Display notes if any -->
                </div>
            </div>
            <div class="connection-point input" title="Input Connection"></div>
            <div class="connection-point output" title="Output Connection"></div>
        `;

         // Apply start node style if applicable
         if (workflowData.startNodeId === nodeData.id) {
            nodeWrapper.querySelector('.node').classList.add('start-node');
         }

         // --- Add Event Listeners ---
         const nodeElement = nodeWrapper.querySelector('.node');

         // Dragging (using node element as handle)
         nodeElement.addEventListener('mousedown', (e) => {
             // Allow dragging only with left mouse button
             if (e.button !== 0) return;
             e.stopPropagation(); // Prevent canvas mousedown
             isDraggingNode = true;
             draggedNodeElement = nodeWrapper;
             draggedNodeElement.classList.add('dragging'); // Add dragging style

             // Calculate offset from top-left corner of the node wrapper
             const rect = nodeWrapper.getBoundingClientRect();
             dragStartOffset.x = e.clientX - rect.left;
             dragStartOffset.y = e.clientY - rect.top;

             hideContextMenu();
         });

         // Node Context Menu
         nodeWrapper.addEventListener('contextmenu', (e) => {
             e.preventDefault();
             e.stopPropagation(); // Prevent canvas context menu
             showContextMenu(e.clientX, e.clientY, nodeData.id);
         });

         // Node Double-click for Settings
         nodeElement.addEventListener('dblclick', (e) => {
             e.stopPropagation();
             openNodeSettings(nodeData.id);
         });


         // Connection Points
         const outputPoint = nodeWrapper.querySelector('.connection-point.output');
         const inputPoint = nodeWrapper.querySelector('.connection-point.input');

         outputPoint.addEventListener('mousedown', (e) => {
             e.stopPropagation(); // Prevent node drag
             e.preventDefault(); // Prevent text selection etc.
             startConnection(outputPoint);
         });

         inputPoint.addEventListener('mouseenter', () => {
             if (isConnecting && connectionStartPointElement?.parentElement !== nodeWrapper) {
                 inputPoint.classList.add('highlight-snap');
                 currentHoveredInputPoint = inputPoint; // Track hovered point
             }
         });

         inputPoint.addEventListener('mouseleave', () => {
             inputPoint.classList.remove('highlight-snap');
             if(currentHoveredInputPoint === inputPoint) {
                 currentHoveredInputPoint = null;
             }
         });

         // Mouseup on input point is handled by the general canvas mouseup (finalizeConnection)

         canvas.appendChild(nodeWrapper);
    }


    /**
     * Deletes a node and its associated connections.
     * @param {number} nodeId - The ID of the node to delete.
     */
    function deleteNode(nodeId) {
        console.log(`Deleting node ${nodeId}`);

        // 1. Remove Node Element
        const nodeEl = document.querySelector(`.node-wrapper[data-id="${nodeId}"]`);
        if (nodeEl) {
            nodeEl.remove();
        }

        // 2. Remove Associated Connections (Data & SVG)
        const connectionsToRemove = workflowData.connections.filter(conn =>
            conn.source === nodeId || conn.target === nodeId
        );
        connectionsToRemove.forEach(conn => {
            const lineEl = document.querySelector(`.connection-line[data-id="${conn.id}"]`);
            if (lineEl) lineEl.remove();
            // Also remove 'connected' class from the other end of the connection
             const otherNodeId = conn.source === nodeId ? conn.target : conn.source;
             const otherNodeEl = document.querySelector(`.node-wrapper[data-id="${otherNodeId}"]`);
             if (otherNodeEl) {
                 const pointClass = conn.source === nodeId ? '.input' : '.output'; // If deleting source, clear target's input
                 const point = otherNodeEl.querySelector(`.connection-point${pointClass}`);
                 if(point) point.classList.remove('connected');
             }

        });

        // 3. Remove Connections from Data Array
        workflowData.connections = workflowData.connections.filter(conn =>
            conn.source !== nodeId && conn.target !== nodeId
        );

        // 4. Remove Node from Data Array
        workflowData.nodes = workflowData.nodes.filter(node => node.id !== nodeId);

         // 5. Unset start node if it was the one deleted
         if (workflowData.startNodeId === nodeId) {
             workflowData.startNodeId = null;
         }

        console.log("Workflow data after deletion:", workflowData);
        // No need to call updateConnections() as lines were removed individually
    }

    /**
     * Simulates running a node (adds CSS classes).
     * @param {number} nodeId - The ID of the node to run.
     */
    function runNode(nodeId) {
        const nodeEl = document.querySelector(`.node-wrapper[data-id="${nodeId}"] .node`);
        if (!nodeEl) return;

        // Clear previous status first
        nodeEl.classList.remove('running', 'success', 'error');

        console.log(`Running node ${nodeId}`);
        nodeEl.classList.add('running');

        // Simulate async operation
        const runTime = 500 + Math.random() * 1000; // 0.5 - 1.5 seconds
        const success = Math.random() > 0.2; // 80% chance of success

        setTimeout(() => {
            nodeEl.classList.remove('running');
            if (success) {
                nodeEl.classList.add('success');
                console.log(`Node ${nodeId} finished successfully.`);
                 // Auto-clear success state after a delay
                 setTimeout(() => nodeEl.classList.remove('success'), 2000);
            } else {
                nodeEl.classList.add('error');
                console.error(`Node ${nodeId} failed.`);
                 // Error state might persist until user interaction or re-run
            }
        }, runTime);
    }

     /**
     * Sets a node as the designated start node for the workflow.
     * @param {number} nodeId - The ID of the node to set as start node.
     */
    function setAsStartNode(nodeId) {
        // Remove class from previous start node (if any)
        if (workflowData.startNodeId) {
            const prevStartNode = document.querySelector(`.node-wrapper[data-id="${workflowData.startNodeId}"] .node`);
            if (prevStartNode) prevStartNode.classList.remove('start-node');
        }

        // Add class to the new start node
        const newStartNode = document.querySelector(`.node-wrapper[data-id="${nodeId}"] .node`);
        if (newStartNode) {
            newStartNode.classList.add('start-node');
            workflowData.startNodeId = nodeId;
            console.log(`Node ${nodeId} set as start node.`);
        } else {
             workflowData.startNodeId = null; // Node not found, reset
             console.warn(`Could not find node ${nodeId} to set as start node.`);
        }
    }

    /** Finds node data by ID */
    function findNodeData(nodeId) {
        return workflowData.nodes.find(n => n.id === nodeId);
    }

    /** Renders the entire workflow (nodes and connections) */
    function renderWorkflow() {
        // Clear existing nodes and lines
        canvas.innerHTML = '';
        // Render nodes first
        workflowData.nodes.forEach(renderNode);
        // Then render connections
        updateAllConnections(); // Use the function that draws all lines
    }


    // --- Connection Management ---

    /**
     * Initiates the connection drawing process from an output point.
     * @param {HTMLElement} outputPointElement - The output connection point element.
     */
    function startConnection(outputPointElement) {
        if (isConnecting) return; // Avoid starting multiple connections

        isConnecting = true;
        connectionStartPointElement = outputPointElement;
        connectionStartPointElement.classList.add('active');

        // Create temporary SVG line
        const startRect = connectionStartPointElement.getBoundingClientRect();
        const startX = startRect.left + startRect.width / 2 - canvasOffset.x;
        const startY = startRect.top + startRect.height / 2 - canvasOffset.y;

        tempConnectionLineSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempConnectionLineSvg.classList.add('connection-line', 'temp');
        // No need for fixed width/height, use position and overflow: visible
        tempConnectionLineSvg.style.position = 'absolute';
        tempConnectionLineSvg.style.left = '0';
        tempConnectionLineSvg.style.top = '0';
        tempConnectionLineSvg.style.width = '100%'; // Cover canvas
        tempConnectionLineSvg.style.height = '100%';// Cover canvas
        tempConnectionLineSvg.style.pointerEvents = 'none'; // Ignore mouse events


        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${startX},${startY} L${startX},${startY}`);
        // Styles are applied via CSS (.connection-line.temp path)
        tempConnectionLineSvg.appendChild(path);

        canvas.appendChild(tempConnectionLineSvg);

        // Highlight potential input targets
        highlightPotentialInputs(true);

        console.log("Starting connection from node:", connectionStartPointElement.closest('.node-wrapper').dataset.id);
    }

     /**
     * Updates the path of the temporary connection line during drag.
     * @param {MouseEvent} e - The mouse event.
     */
    function updateTemporaryLine(e) {
        if (!isConnecting || !connectionStartPointElement || !tempConnectionLineSvg) return;

        const path = tempConnectionLineSvg.querySelector('path');
        if (!path) return;

        const startRect = connectionStartPointElement.getBoundingClientRect();
        const startX = startRect.left + startRect.width / 2 - canvasOffset.x;
        const startY = startRect.top + startRect.height / 2 - canvasOffset.y;

        let endX = e.clientX - canvasOffset.x;
        let endY = e.clientY - canvasOffset.y;

         // If snapping to a point, use its center
         if (currentHoveredInputPoint) {
             const endRect = currentHoveredInputPoint.getBoundingClientRect();
             endX = endRect.left + endRect.width / 2 - canvasOffset.x;
             endY = endRect.top + endRect.height / 2 - canvasOffset.y;
         }


        // Calculate control points for Bezier curve
        const deltaX = Math.abs(endX - startX);
        // Make curve gentler for short horizontal distances
        const controlPointOffset = Math.max(deltaX * 0.5, 30);

        const d = `M${startX},${startY} C${startX + controlPointOffset},${startY} ${endX - controlPointOffset},${endY} ${endX},${endY}`;
        path.setAttribute('d', d);
    }

     /**
      * Handles snapping visualization during connection drag.
      * @param {MouseEvent} e - The mouse move event.
      */
     function handleConnectionSnapping(e) {
         if (!isConnecting) return;

         const snapDistance = 25; // Pixel radius for snapping
         let foundSnapTarget = false;

         document.querySelectorAll('.connection-point.input').forEach(inputPoint => {
             // Don't snap to the input of the starting node
             if (inputPoint.closest('.node-wrapper') === connectionStartPointElement.closest('.node-wrapper')) {
                 return;
             }
             // Only check highlighted points (potential targets)
              if (!inputPoint.classList.contains('highlight')) {
                 // Exception: if it's the currently hovered one, allow checking
                 if(inputPoint !== currentHoveredInputPoint) return;
              }


             const rect = inputPoint.getBoundingClientRect();
             const pointCenterX = rect.left + rect.width / 2;
             const pointCenterY = rect.top + rect.height / 2;

             const distance = Math.sqrt(
                 Math.pow(e.clientX - pointCenterX, 2) +
                 Math.pow(e.clientY - pointCenterY, 2)
             );

             if (distance < snapDistance) {
                  if (!inputPoint.classList.contains('highlight-snap')) {
                     // Remove snap from previous point if any
                     if(currentHoveredInputPoint && currentHoveredInputPoint !== inputPoint) {
                         currentHoveredInputPoint.classList.remove('highlight-snap');
                     }
                     // Add snap to this point
                     inputPoint.classList.add('highlight-snap');
                     currentHoveredInputPoint = inputPoint;
                  }
                 foundSnapTarget = true;
             } else {
                  if (inputPoint.classList.contains('highlight-snap')) {
                     inputPoint.classList.remove('highlight-snap');
                     if(currentHoveredInputPoint === inputPoint) {
                         currentHoveredInputPoint = null;
                     }
                  }
             }
         });

         // If no target is found by distance check, ensure currentHoveredInput is cleared
         // (This handles moving away from a snapped point)
         // This check is implicitly handled by the logic within the loop now.
     }


    /**
     * Finalizes the connection attempt on mouse up.
     * @param {MouseEvent} e - The mouse event.
     */
    function finalizeConnection(e) {
        let targetInputPoint = null;

        // Priority 1: Check if mouse is released over the currently snapped point
        if (currentHoveredInputPoint && currentHoveredInputPoint.classList.contains('highlight-snap')) {
            targetInputPoint = currentHoveredInputPoint;
             console.log("Connecting via snapped point:", targetInputPoint.closest('.node-wrapper').dataset.id);
        } else {
            // Priority 2: Check elements directly under the cursor
            const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
            targetInputPoint = elementsUnderCursor.find(el =>
                el.classList.contains('connection-point') &&
                el.classList.contains('input') &&
                el.classList.contains('highlight') && // Must be a valid target
                el.closest('.node-wrapper') !== connectionStartPointElement.closest('.node-wrapper')
            );
             if(targetInputPoint) {
                console.log("Connecting via elementsFromPoint:", targetInputPoint.closest('.node-wrapper').dataset.id);
             }
        }


        if (targetInputPoint) {
            // --- Create the Connection ---
            const sourceNodeId = parseInt(connectionStartPointElement.closest('.node-wrapper').dataset.id);
            const targetNodeId = parseInt(targetInputPoint.closest('.node-wrapper').dataset.id);

            // Check if connection already exists
            const exists = workflowData.connections.some(conn =>
                conn.source === sourceNodeId && conn.target === targetNodeId
            );

            if (!exists) {
                const connectionData = {
                    id: `conn_${Date.now()}_${Math.random().toString(16).slice(2)}`, // More unique ID
                    source: sourceNodeId,
                    target: targetNodeId
                };
                workflowData.connections.push(connectionData);
                createConnectionLine(connectionData); // Draw the permanent line
                console.log("Connection created:", connectionData);

                // Mark points as connected
                connectionStartPointElement.classList.add('connected');
                targetInputPoint.classList.add('connected');

                 // Brief visual feedback on the line
                 const lineEl = document.querySelector(`.connection-line[data-id="${connectionData.id}"] path`);
                 if (lineEl) {
                     lineEl.style.stroke = '#ff55aa'; // Pink flash
                     setTimeout(() => {
                         lineEl.style.stroke = ''; // Revert to CSS default (#aaa)
                     }, 300);
                 }

            } else {
                console.log("Connection already exists.");
                // Optionally provide user feedback here
            }
        } else {
            console.log("Connection cancelled - no valid target.");
        }

        // --- Cleanup ---
        cancelConnection();
    }


    /**
     * Cleans up the temporary connection state.
     */
    function cancelConnection() {
        if (tempConnectionLineSvg) {
            tempConnectionLineSvg.remove();
            tempConnectionLineSvg = null;
        }
        if (connectionStartPointElement) {
            connectionStartPointElement.classList.remove('active');
            connectionStartPointElement = null;
        }
        highlightPotentialInputs(false); // Remove highlights
        if (currentHoveredInputPoint) {
             currentHoveredInputPoint.classList.remove('highlight-snap');
             currentHoveredInputPoint = null;
        }
        isConnecting = false;
        console.log("Connection process ended/cancelled.");
    }

    /**
     * Creates the visual SVG line for a connection.
     * @param {object} connectionData - The connection data {id, source, target}.
     */
    function createConnectionLine(connectionData) {
         const sourceNodeEl = document.querySelector(`.node-wrapper[data-id="${connectionData.source}"]`);
         const targetNodeEl = document.querySelector(`.node-wrapper[data-id="${connectionData.target}"]`);

         if (!sourceNodeEl || !targetNodeEl) {
             console.warn(`Cannot draw line, node element not found for connection:`, connectionData);
             return;
         }

         const outputPoint = sourceNodeEl.querySelector('.connection-point.output');
         const inputPoint = targetNodeEl.querySelector('.connection-point.input');

         if (!outputPoint || !inputPoint) {
             console.warn(`Cannot draw line, connection points not found for connection:`, connectionData);
             return;
         }

         // Create SVG container for the line if it doesn't exist for this connection ID
         let svgLine = document.querySelector(`.connection-line[data-id="${connectionData.id}"]`);
         if (!svgLine) {
             svgLine = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
             svgLine.classList.add('connection-line');
             svgLine.dataset.id = connectionData.id;
             svgLine.dataset.source = connectionData.source;
             svgLine.dataset.target = connectionData.target;
             // Position and size set by CSS to cover canvas
             svgLine.style.pointerEvents = 'none'; // SVG container doesn't block clicks
             svgLine.style.overflow = 'visible'; // Allow path outside bounds


             const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
             path.setAttribute('d', 'M0,0 L0,0'); // Initial dummy path
             // Styles and pointer-events set by CSS (.connection-line path)
             svgLine.appendChild(path);
             canvas.appendChild(svgLine);

             // Add click listener to the PATH for deletion
             path.addEventListener('click', (e) => {
                 e.stopPropagation(); // Prevent canvas click
                 if (confirm(`Delete connection between node ${connectionData.source} and ${connectionData.target}?`)) {
                     deleteConnection(connectionData.id);
                 }
             });
         }

         // Update the path geometry
         updateSingleConnectionLine(connectionData.id);
    }

     /**
      * Updates the geometry (d attribute) of a single connection line SVG path.
      * @param {string} connectionId - The ID of the connection to update.
      */
     function updateSingleConnectionLine(connectionId) {
         const svgLine = document.querySelector(`.connection-line[data-id="${connectionId}"]`);
         const path = svgLine?.querySelector('path');
         if (!path) return; // Line might have been deleted

         const connData = workflowData.connections.find(c => c.id === connectionId);
         if (!connData) return; // Connection data removed

         const sourceNodeEl = document.querySelector(`.node-wrapper[data-id="${connData.source}"]`);
         const targetNodeEl = document.querySelector(`.node-wrapper[data-id="${connData.target}"]`);
         if (!sourceNodeEl || !targetNodeEl) return; // Node removed

         const outputPoint = sourceNodeEl.querySelector('.connection-point.output');
         const inputPoint = targetNodeEl.querySelector('.connection-point.input');
         if (!outputPoint || !inputPoint) return; // Points not found

         // Calculate positions relative to the canvas
         const outputRect = outputPoint.getBoundingClientRect();
         const inputRect = inputPoint.getBoundingClientRect();

         const startX = outputRect.left + outputRect.width / 2 - canvasOffset.x;
         const startY = outputRect.top + outputRect.height / 2 - canvasOffset.y;
         const endX = inputRect.left + inputRect.width / 2 - canvasOffset.x;
         const endY = inputRect.top + inputRect.height / 2 - canvasOffset.y;

         // Bezier curve calculation
         const deltaX = Math.abs(endX - startX);
         const controlPointOffset = Math.max(deltaX * 0.5, 30);

         const d = `M${startX},${startY} C${startX + controlPointOffset},${startY} ${endX - controlPointOffset},${endY} ${endX},${endY}`;
         path.setAttribute('d', d);
     }


    /**
     * Updates all connection lines associated with a specific node.
     * @param {number} nodeId - The ID of the node whose connections need updating.
     */
    function updateConnectionsForNode(nodeId) {
        workflowData.connections.forEach(conn => {
            if (conn.source === nodeId || conn.target === nodeId) {
                updateSingleConnectionLine(conn.id);
            }
        });
    }

     /**
      * Redraws ALL connection lines based on current workflowData.
      */
     function updateAllConnections() {
         // Remove potentially orphaned lines first (if nodes were deleted without line cleanup)
          document.querySelectorAll('.connection-line:not(.temp)').forEach(lineSvg => {
              const connId = lineSvg.dataset.id;
              if (!workflowData.connections.some(c => c.id === connId)) {
                  lineSvg.remove();
              }
          });
         // Create or update all connections in the data
         workflowData.connections.forEach(conn => {
             createConnectionLine(conn); // This will either create or update the path
         });
     }

    /**
     * Deletes a specific connection.
     * @param {string} connectionId - The ID of the connection to delete.
     */
    function deleteConnection(connectionId) {
        console.log(`Deleting connection ${connectionId}`);

        const connectionIndex = workflowData.connections.findIndex(conn => conn.id === connectionId);
        if (connectionIndex === -1) return; // Not found

        const connectionData = workflowData.connections[connectionIndex];

        // 1. Remove SVG Line
        const lineEl = document.querySelector(`.connection-line[data-id="${connectionId}"]`);
        if (lineEl) lineEl.remove();

        // 2. Remove 'connected' class from points
        const sourceNodeEl = document.querySelector(`.node-wrapper[data-id="${connectionData.source}"]`);
        const targetNodeEl = document.querySelector(`.node-wrapper[data-id="${connectionData.target}"]`);
        if (sourceNodeEl) sourceNodeEl.querySelector('.connection-point.output')?.classList.remove('connected');
        if (targetNodeEl) targetNodeEl.querySelector('.connection-point.input')?.classList.remove('connected');

        // 3. Remove connection from data
        workflowData.connections.splice(connectionIndex, 1);

        console.log("Workflow connections after deletion:", workflowData.connections);
    }


    /**
     * Adds or removes the 'highlight' class from potential input points.
     * @param {boolean} show - True to add highlight, false to remove.
     */
    function highlightPotentialInputs(show) {
         document.querySelectorAll('.connection-point.input').forEach(point => {
             // Don't highlight the input on the node we are dragging from
             if (connectionStartPointElement && point.closest('.node-wrapper') === connectionStartPointElement.closest('.node-wrapper')) {
                 return;
             }
             if (show) {
                 point.classList.add('highlight');
             } else {
                 point.classList.remove('highlight');
                 point.classList.remove('highlight-snap'); // Also remove snap highlight
             }
         });
         // Reset the tracked snapped point if highlights are removed
         if (!show) {
             currentHoveredInputPoint = null;
         }
    }


    // --- Context Menu ---

    function showContextMenu(x, y, nodeId) {
        hideContextMenu(); // Hide previous first

        // Adjust position if too close to edge
        const menuWidth = 150; // Approximate width
        const menuHeight = 150; // Approximate height
        if (x + menuWidth > window.innerWidth) {
            x = window.innerWidth - menuWidth - 5;
        }
        if (y + menuHeight > window.innerHeight) {
            y = window.innerHeight - menuHeight - 5;
        }


        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.dataset.nodeId = nodeId; // Store node ID on the menu

        // Attach listeners here to ensure they are fresh for this instance
        contextMenu.querySelectorAll('li').forEach(item => {
            // Remove old listener before adding new one
            item.replaceWith(item.cloneNode(true));
        });
        contextMenu.querySelectorAll('li').forEach(item => {
             item.addEventListener('click', handleContextMenuClick);
        });

        console.log(`Context menu shown for node ${nodeId} at (${x}, ${y})`);
    }

    function hideContextMenu() {
        if (contextMenu.style.display === 'block') {
             contextMenu.style.display = 'none';
             contextMenu.removeAttribute('data-node-id');
             console.log("Context menu hidden");
        }
    }

    function handleContextMenuClick(e) {
        const action = e.target.dataset.action;
        const nodeId = parseInt(contextMenu.dataset.nodeId);

        if (!action || isNaN(nodeId)) {
            console.error("Context menu action or nodeId missing");
            hideContextMenu();
            return;
        }

        console.log(`Context action: ${action} on node ${nodeId}`);

        switch (action) {
            case 'delete':
                if (confirm(`Are you sure you want to delete node ${nodeId}?`)) {
                    deleteNode(nodeId);
                }
                break;
            case 'run-node':
                runNode(nodeId);
                break;
            case 'set-start-node':
                setAsStartNode(nodeId);
                break;
             case 'copy': // Placeholder
                 console.log("Copy node action (not implemented)");
                 alert("Copy functionality not yet implemented.");
                 break;
            // Add other actions here
        }
        hideContextMenu(); // Hide menu after action
    }


    // --- Node Selector ---

    function showNodeSelector(x, y, centered = false) {
         hideNodeSelector(); // Hide previous first
         nodeSelector.style.display = 'flex'; // Use flex display now
         nodeSearchInput.value = ''; // Clear search
         filterNodeSelector(); // Show all nodes initially

         nodeSelector.dataset.centered = centered; // Mark if opened via button

         if (centered) {
             // Centered positioning is handled by CSS transform
             nodeSelector.style.left = '50%';
             nodeSelector.style.top = '50%';
             nodeSelector.style.transform = 'translate(-50%, -50%)';
         } else if (x !== null && y !== null) {
             // Position near mouse click (adjust for menu size)
             const selectorWidth = nodeSelector.offsetWidth;
             const selectorHeight = nodeSelector.offsetHeight;
             let posX = x + 10;
             let posY = y + 10;

             // Keep within viewport
             if (posX + selectorWidth > window.innerWidth) {
                 posX = window.innerWidth - selectorWidth - 10;
             }
              if (posY + selectorHeight > window.innerHeight) {
                 posY = window.innerHeight - selectorHeight - 10;
             }
             posX = Math.max(10, posX);
             posY = Math.max(10, posY);


             nodeSelector.style.left = `${posX}px`;
             nodeSelector.style.top = `${posY}px`;
             nodeSelector.style.transform = 'none'; // Override centered transform
         } else {
             // Default to center if coordinates are somehow null/undefined
             nodeSelector.style.left = '50%';
             nodeSelector.style.top = '50%';
             nodeSelector.style.transform = 'translate(-50%, -50%)';
         }

        nodeSearchInput.focus(); // Focus the search input
        console.log("Node selector shown");
    }

    function hideNodeSelector() {
        if(nodeSelector.style.display !== 'none') {
             nodeSelector.style.display = 'none';
             nodeSelector.removeAttribute('data-centered');
             console.log("Node selector hidden");
        }
    }

    function filterNodeSelector() {
        const searchTerm = nodeSearchInput.value.toLowerCase().trim();
        const items = nodeSelector.querySelectorAll('.node-select-item');
        const categories = nodeSelector.querySelectorAll('.category');

        items.forEach(item => {
            const type = item.dataset.type.toLowerCase();
            const name = item.querySelector('span').textContent.toLowerCase();
            const matches = type.includes(searchTerm) || name.includes(searchTerm);
            item.style.display = matches ? 'flex' : 'none';
        });

        // Optionally hide categories with no visible items
        categories.forEach(category => {
             const visibleItems = category.querySelectorAll('.node-select-item[style*="display: flex"]');
             // const visibleItems = Array.from(category.querySelectorAll('.node-select-item')).filter(it => it.style.display !== 'none');
             category.style.display = visibleItems.length > 0 ? 'block' : 'none';
        });
    }


    // --- Workflow Export ---

    function formatWorkflowForN8n() {
        const n8nWorkflow = {
            nodes: [],
            connections: {},
            settings: { // Basic settings example
                 executionOrder: workflowData.startNodeId ? [String(workflowData.startNodeId)] : [] // Requires more logic for full order
             },
            staticData: null
        };

        // Format Nodes
        workflowData.nodes.forEach(node => {
            n8nWorkflow.nodes.push({
                parameters: node.parameters || {}, // Use stored params or empty object
                id: String(node.id), // n8n uses string IDs
                name: node.name || `${node.type.charAt(0).toUpperCase() + node.slice(1)} ${node.id}`, // Use stored name or generate
                type: `n8n-nodes-base.${node.type}`, // Basic n8n type format (might need adjustment for specific nodes)
                typeVersion: 1, // Default version
                position: [node.position.x, node.position.y],
                notesInFlow: !!node.notes, // Boolean flag if notes exist
                notes: node.notes || '',
                // credentials: {} // Add credentials if needed later
            });
        });

        // Format Connections
        workflowData.connections.forEach(conn => {
            const sourceIdStr = String(conn.source);
            const targetIdStr = String(conn.target);

            if (!n8nWorkflow.connections[sourceIdStr]) {
                n8nWorkflow.connections[sourceIdStr] = {};
            }
            if (!n8nWorkflow.connections[sourceIdStr]['main']) {
                 n8nWorkflow.connections[sourceIdStr]['main'] = [];
            }

            // Avoid duplicates (though our model shouldn't allow them)
             if (!n8nWorkflow.connections[sourceIdStr]['main'].some(c => c.node === targetIdStr)) {
                 n8nWorkflow.connections[sourceIdStr]['main'].push({
                     node: targetIdStr,
                     input: 'main' // Assuming single 'main' input/output for now
                 });
             }
        });

        return n8nWorkflow;
    }

    function showExportModal() {
        const n8nJson = formatWorkflowForN8n();
        exportTextarea.value = JSON.stringify(n8nJson, null, 2); // Pretty print
        exportModal.style.display = 'block';
    }

    function hideExportModal() {
        exportModal.style.display = 'none';
    }

    function copyExportJsonToClipboard() {
        exportTextarea.select();
        exportTextarea.setSelectionRange(0, 99999); // For mobile devices

        try {
            const successful = document.execCommand('copy');
            const msg = successful ? 'Copied to clipboard!' : 'Copy failed!';
            alert(msg); // Simple feedback
            console.log('Copy attempt:', msg);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            alert('Could not copy text. Please copy manually.');
        }
        // Deselect text
        window.getSelection()?.removeAllRanges();
    }


    // --- Workflow Load/Save (Placeholders) ---
    function saveWorkflow() {
        // Example: Save to localStorage
        // localStorage.setItem('myWorkflowData', JSON.stringify(workflowData));
        // console.log("Workflow saved.");
        alert("Save functionality not implemented yet.");
    }

    function loadWorkflow() {
         // Example: Load from localStorage
        // const savedData = localStorage.getItem('myWorkflowData');
        // if (savedData) {
        //     const parsedData = JSON.parse(savedData);
        //     workflowData.nodes = parsedData.nodes || [];
        //     workflowData.connections = parsedData.connections || [];
        //     workflowData.nextNodeId = parsedData.nextNodeId || 1;
        //     workflowData.startNodeId = parsedData.startNodeId || null;
        //     console.log("Workflow loaded.");
        //     renderWorkflow(); // Render the loaded data
        // } else {
        //     console.log("No saved workflow found.");
        // }
    }

    // --- Settings Modal --- (Added Section)

    /**
     * Opens the settings modal for a specific node.
     * @param {number} nodeId - The ID of the node to configure.
     */
    function openNodeSettings(nodeId) {
        const nodeData = findNodeData(nodeId);
        if (!nodeData) {
            console.error(`Node data not found for ID: ${nodeId}`);
            return;
        }

        // Store node ID for saving later
        settingsModal.dataset.editingNodeId = nodeId;

        // Clear previous test results
        httpTestResultPre.textContent = '';

        // --- Populate Common Fields ---
        nodeSettingNameInput.value = nodeData.name || '';
        nodeSettingNotesInput.value = nodeData.notes || '';

        // --- Handle Type-Specific Settings ---
        // 1. Hide all type-specific sections first
        typeSpecificSettingsContainer.querySelectorAll('.type-settings').forEach(section => {
            section.style.display = 'none';
        });

        // 2. Show the relevant section for the node type
        const typeSettingsSection = typeSpecificSettingsContainer.querySelector(`.type-settings[data-node-type="${nodeData.type}"]`);
        if (typeSettingsSection) {
            typeSettingsSection.style.display = 'block';

            // 3. Populate fields for the specific type (add more cases as needed)
            if (nodeData.type === 'http') {
                const params = nodeData.parameters || {};
                nodeSettingHttpUrlInput.value = params.url || '';
                nodeSettingHttpMethodSelect.value = params.method || 'GET';
                nodeSettingHttpHeadersTextarea.value = params.headers ? JSON.stringify(params.headers, null, 2) : '';
                nodeSettingHttpBodyTextarea.value = params.body || ''; // Assuming body is stored as string
                 // Clear previous test result specific to HTTP
                httpTestResultPre.textContent = '';
            }
            // else if (nodeData.type === 'mysql') { ... populate mysql fields ... }

        } else {
            console.warn(`No settings section defined for node type: ${nodeData.type}`);
        }


        // --- Show Modal ---
        settingsModal.style.display = 'block';
        // Focus the first input
        nodeSettingNameInput.focus();

        console.log(`Opened settings for node ${nodeId}`);
    }

     /** Closes the node settings modal */
    function hideNodeSettingsModal() {
        settingsModal.style.display = 'none';
        settingsModal.removeAttribute('data-editing-node-id');
        console.log("Node settings modal closed.");
    }

    /** Saves the current settings from the modal to the node data */
    function saveNodeSettings() {
        const nodeId = parseInt(settingsModal.dataset.editingNodeId);
        const nodeData = findNodeData(nodeId);

        if (!nodeData) {
            console.error("Could not save settings: Node data not found.");
            hideNodeSettingsModal();
            return;
        }

        // --- Save Common Fields ---
        nodeData.name = nodeSettingNameInput.value.trim() || `${nodeData.type} ${nodeId}`; // Provide default if empty
        nodeData.notes = nodeSettingNotesInput.value.trim();

        // --- Save Type-Specific Fields ---
        const typeSettingsSection = typeSpecificSettingsContainer.querySelector(`.type-settings[data-node-type="${nodeData.type}"]:not([style*="display: none"])`);
        if (typeSettingsSection) {
            if (!nodeData.parameters) nodeData.parameters = {}; // Ensure parameters object exists

            if (nodeData.type === 'http') {
                 nodeData.parameters.url = nodeSettingHttpUrlInput.value.trim();
                 nodeData.parameters.method = nodeSettingHttpMethodSelect.value;
                 try {
                     // Store headers as an object
                     nodeData.parameters.headers = nodeSettingHttpHeadersTextarea.value.trim() ? JSON.parse(nodeSettingHttpHeadersTextarea.value) : {};
                 } catch (e) {
                     console.error("Invalid JSON in Headers:", e);
                     alert('Error: Invalid JSON format in Headers field. Please correct it.');
                     // Optionally, focus the field: nodeSettingHttpHeadersTextarea.focus();
                     return; // Prevent saving with invalid JSON
                 }
                 nodeData.parameters.body = nodeSettingHttpBodyTextarea.value; // Keep body as string for flexibility
            }
            // else if (nodeData.type === 'mysql') { ... save mysql params ... }
        }

        console.log(`Settings saved for node ${nodeId}:`, nodeData);

        // --- Update Node Appearance ---
        // Re-render the node to reflect changes (e.g., name, notes)
        renderNode(nodeData);

        // --- Close Modal ---
        hideNodeSettingsModal();
    }

    /**
     * Executes the HTTP request based on the settings in the modal for testing.
     */
    async function testHttpRequest() {
        const url = nodeSettingHttpUrlInput.value.trim();
        const method = nodeSettingHttpMethodSelect.value;
        const headersStr = nodeSettingHttpHeadersTextarea.value.trim();
        const body = nodeSettingHttpBodyTextarea.value; // Body is used as is (string)

        httpTestResultPre.textContent = 'Testing request...'; // i18n needed
        httpTestResultPre.style.color = '#888';

        if (!url) {
            httpTestResultPre.textContent = 'Error: URL is required.'; // i18n needed
            httpTestResultPre.style.color = 'red';
            return;
        }

        let headers = {};
        try {
            if (headersStr) {
                headers = JSON.parse(headersStr);
            }
        } catch (e) {
            httpTestResultPre.textContent = `Error: Invalid JSON in Headers.\n${e.message}`; // i18n needed
            httpTestResultPre.style.color = 'red';
            return;
        }

        const requestOptions = {
            method: method,
            headers: headers,
        };

        // Add body only for relevant methods (avoiding errors for GET/HEAD)
        if (method !== 'GET' && method !== 'HEAD' && body) {
            requestOptions.body = body;
        }

        try {
            const response = await fetch(url, requestOptions);

            const result = {
                status: response.status,
                statusText: response.statusText,
                headers: {},
                body: await response.text() // Get body as text first
            };

             // Extract headers
             response.headers.forEach((value, key) => {
                 result.headers[key] = value;
             });

             // Try to parse body as JSON if content-type suggests it
             const contentType = response.headers.get('content-type');
             if (contentType && contentType.includes('application/json') && result.body) {
                 try {
                     result.body = JSON.parse(result.body);
                 } catch (e) {
                     console.warn("Response body looked like JSON but failed to parse:", e);
                     // Keep body as text if JSON parsing fails
                 }
             }

            // Display formatted result
            httpTestResultPre.textContent = JSON.stringify(result, null, 2);
            httpTestResultPre.style.color = response.ok ? 'green' : 'orange';

        } catch (error) {
            console.error('HTTP Request Test Failed:', error);
            httpTestResultPre.textContent = `Request Failed:\n${error.message}\n\nCheck browser console and network tab for details. Possible CORS issue if testing external APIs.`; // i18n needed
            httpTestResultPre.style.color = 'red';
        }
    }

    // --- End Settings Modal ---

    // --- Start the Application ---
    initializeApp();

}); // End DOMContentLoaded
