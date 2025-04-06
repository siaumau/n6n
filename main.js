document.addEventListener('DOMContentLoaded', function() {
    // 工作流相關數據
    const workflowData = {
        nodes: [],
        connections: [],
        nextNodeId: 1
    };

    // 畫布與拖拽相關變量
    const canvas = document.getElementById('workflow-canvas');
    let canvasOffset = { x: canvas.offsetLeft, y: canvas.offsetTop };
    let canvasScale = 1;
    let isDragging = false;
    let draggedNode = null;
    let dragOffset = { x: 0, y: 0 };
    let isConnecting = false;  // 定義isConnecting變量
    let connectionStartPoint = null;
    let tempConnectionLine = null;

    // 上下文選單元素
    const contextMenu = document.getElementById('node-context-menu');

    // 節點選擇器元素
    const nodeSelector = document.getElementById('node-selector');

    // 初始化畫布事件
    initCanvasEvents();

    // 初始化其他UI事件
    initUIEvents();

    // 加載示例工作流
    loadExampleWorkflow();

    /**
     * 初始化畫布事件
     */
    function initCanvasEvents() {
        // 畫布點擊事件
        canvas.addEventListener('click', function(e) {
            // 隱藏上下文選單
            contextMenu.style.display = 'none';

            // 如果正在連接節點，取消連接
            if (isConnecting) {
                cancelConnection();
            }
        });

        // 畫布右鍵事件
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();

            // 顯示節點選擇器
            showNodeSelector(e.clientX, e.clientY);
        });

        // 畫布拖動事件
        canvas.addEventListener('mousemove', function(e) {
            if (isDragging && draggedNode) {
                const x = e.clientX - canvasOffset.x - dragOffset.x;
                const y = e.clientY - canvasOffset.y - dragOffset.y;

                draggedNode.style.left = x + 'px';
                draggedNode.style.top = y + 'px';

                // 更新節點數據
                const nodeId = draggedNode.getAttribute('data-id');
                const node = workflowData.nodes.find(n => n.id === parseInt(nodeId));
                if (node) {
                    node.position = { x, y };

                    // 更新連接線
                    updateConnections();
                }
            }

            // 如果正在連接節點，更新臨時連接線
            if (isConnecting && connectionStartPoint && tempConnectionLine) {
                const endX = e.clientX - canvasOffset.x;
                const endY = e.clientY - canvasOffset.y;

                updateTempConnectionLine(endX, endY);
            }
        });

        // 結束拖動事件
        document.addEventListener('mouseup', function(e) {
            isDragging = false;
            draggedNode = null;

            // 如果正在連接節點並且有臨時連接線，嘗試完成連接
            if (isConnecting && tempConnectionLine) {
                finishConnection(e);
            }
        });

        // 初始化畫布位置偏移
        updateCanvasOffset();
        window.addEventListener('resize', updateCanvasOffset);

        // 處理連接節點時的吸附效果
        document.addEventListener('mousemove', function(e) {
            if (isConnecting && connectionStartPoint && tempConnectionLine) {
                // 默認終點是鼠標位置
                let endX = e.clientX - canvasOffset.x;
                let endY = e.clientY - canvasOffset.y;

                // 檢查是否鼠標靠近某個輸入連接點
                const mouseX = e.clientX;
                const mouseY = e.clientY;
                const snapDistance = 30; // 吸附距離（像素）

                let closestPoint = null;
                let minDistance = snapDistance;

                // 尋找最近的輸入連接點
                document.querySelectorAll('.connection-point.input').forEach(point => {
                    const rect = point.getBoundingClientRect();
                    const pointCenterX = rect.left + rect.width / 2;
                    const pointCenterY = rect.top + rect.height / 2;

                    // 計算距離
                    const distance = Math.sqrt(
                        Math.pow(mouseX - pointCenterX, 2) +
                        Math.pow(mouseY - pointCenterY, 2)
                    );

                    // 檢查是否是最近的點且不屬於同一節點
                    if (distance < minDistance && point.parentElement !== connectionStartPoint.parentElement) {
                        minDistance = distance;
                        closestPoint = point;
                    }
                });

                // 如果有最近的點，使用其位置作為終點
                if (closestPoint) {
                    const rect = closestPoint.getBoundingClientRect();
                    endX = rect.left + rect.width / 2 - canvasOffset.x;
                    endY = rect.top + rect.height / 2 - canvasOffset.y;

                    // 高亮顯示
                    document.querySelectorAll('.connection-point.highlight-snap').forEach(p => {
                        p.classList.remove('highlight-snap');
                    });
                    closestPoint.classList.add('highlight-snap');
                } else {
                    // 移除所有吸附高亮
                    document.querySelectorAll('.connection-point.highlight-snap').forEach(p => {
                        p.classList.remove('highlight-snap');
                    });
                }

                updateTempConnectionLine(endX, endY);
            }
        });
    }

    /**
     * 初始化其他UI事件
     */
    function initUIEvents() {
        // 添加按鈕事件
        document.querySelector('.add-btn').addEventListener('click', function() {
            showNodeSelector();
        });

        // 節點選擇器關閉按鈕
        document.querySelector('.node-selector .close-btn').addEventListener('click', function() {
            hideNodeSelector();
        });

        // 節點選擇事件
        document.querySelectorAll('.node-selector .node').forEach(nodeEl => {
            nodeEl.addEventListener('click', function() {
                const nodeType = this.getAttribute('data-type');
                const centerX = canvas.clientWidth / 2 - 90;
                const centerY = canvas.clientHeight / 2 - 50;

                addNode(nodeType, centerX, centerY);
                hideNodeSelector();
            });
        });
    }

    /**
     * 加載示例工作流
     */
    function loadExampleWorkflow() {
        // 添加節點
        const trigger = addNode('webhook', 150, 200);
        trigger.querySelector('.node-title').textContent = "When clicking 'Test workflow'";

        const mysql = addNode('mysql', 350, 200);
        mysql.querySelector('.node-title').textContent = "MySQL";
        mysql.querySelector('.node-content').textContent = "select";

        const datetime = addNode('datetime', 550, 200);
        datetime.querySelector('.node-title').textContent = "Date & Time";

        // 創建連接
        createConnection(
            trigger.querySelector('.connection-point.output'),
            mysql.querySelector('.connection-point.input')
        );

        createConnection(
            mysql.querySelector('.connection-point.output'),
            datetime.querySelector('.connection-point.input')
        );
    }

    /**
     * 添加節點
     * @param {string} type 節點類型
     * @param {number} x X坐標
     * @param {number} y Y坐標
     * @returns {HTMLElement} 節點元素
     */
    function addNode(type, x, y) {
        const nodeId = workflowData.nextNodeId++;
        const nodeData = {
            id: nodeId,
            type: type,
            position: { x, y },
            data: {}
        };

        // 創建節點DOM元素
        const nodeEl = document.createElement('div');
        nodeEl.className = 'node-wrapper';
        nodeEl.style.left = x + 'px';
        nodeEl.style.top = y + 'px';
        nodeEl.setAttribute('data-id', nodeId);

        // 節點內容
        let nodeIconClass = 'fas fa-cog';
        let nodeColor = '#888';
        let nodeBorderClass = '';
        let leftBorderColor = '';

        switch (type) {
            case 'webhook':
                nodeIconClass = 'fas fa-bolt';
                nodeColor = '#ff7043';
                nodeBorderClass = 'trigger-node';
                leftBorderColor = '#ff7043';
                break;
            case 'mysql':
                nodeIconClass = 'fas fa-database';
                nodeColor = '#29b6f6';
                nodeBorderClass = 'database-node';
                leftBorderColor = '#29b6f6';
                break;
            case 'datetime':
                nodeIconClass = 'fas fa-clock';
                nodeColor = '#4caf50';
                nodeBorderClass = 'utility-node';
                leftBorderColor = '#4caf50';
                break;
            case 'function':
                nodeIconClass = 'fas fa-code';
                nodeColor = '#9c27b0';
                nodeBorderClass = 'utility-node';
                leftBorderColor = '#9c27b0';
                break;
        }

        nodeEl.innerHTML = `
            <div class="node ${nodeBorderClass}" data-type="${type}" style="border-left: 3px solid ${leftBorderColor}">
                <div class="node-header">
                    <div class="node-icon" style="background-color: ${nodeColor}">
                        <i class="${nodeIconClass}"></i>
                    </div>
                    <div class="node-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                </div>
                <div class="node-content"></div>
            </div>
            <div class="connection-point input" title="輸入連接點"></div>
            <div class="connection-point output" title="輸出連接點"></div>
        `;

        // 添加節點拖拽事件
        const nodeHeader = nodeEl.querySelector('.node-header');
        nodeHeader.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            isDragging = true;
            draggedNode = nodeEl;

            const rect = nodeEl.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
        });

        // 添加節點右鍵選單事件
        nodeEl.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();

            showContextMenu(e.clientX, e.clientY, nodeId);
        });

        // 添加連接點事件
        const inputPoint = nodeEl.querySelector('.connection-point.input');
        const outputPoint = nodeEl.querySelector('.connection-point.output');

        outputPoint.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            // 開始連接
            startConnection(outputPoint);
        });

        // 連接點滑鼠放開事件
        inputPoint.addEventListener('mouseup', function(e) {
            e.stopPropagation();
            // 完成連接
            if (isConnecting && connectionStartPoint) {
                finishConnectionToPoint(inputPoint);
            }
        });

        // 將節點添加到畫布
        canvas.appendChild(nodeEl);

        // 將節點數據添加到工作流數據
        workflowData.nodes.push(nodeData);

        return nodeEl;
    }

    /**
     * 創建連接
     * @param {HTMLElement} startPoint 起始連接點
     * @param {HTMLElement} endPoint 結束連接點
     */
    function createConnection(startPoint, endPoint) {
        if (!startPoint || !endPoint) return;

        const startNodeEl = startPoint.parentElement;
        const endNodeEl = endPoint.parentElement;

        if (!startNodeEl || !endNodeEl) return;

        const startNodeId = parseInt(startNodeEl.getAttribute('data-id'));
        const endNodeId = parseInt(endNodeEl.getAttribute('data-id'));

        // 檢查是否已經存在連接
        const existingConnection = workflowData.connections.find(conn =>
            conn.source === startNodeId && conn.target === endNodeId);

        if (existingConnection) return;

        // 創建連接數據
        const connectionData = {
            id: Date.now(),
            source: startNodeId,
            target: endNodeId
        };

        // 將連接數據添加到工作流數據
        workflowData.connections.push(connectionData);

        // 創建連接線DOM元素
        createConnectionLine(connectionData);
    }

    /**
     * 創建連接線DOM元素
     * @param {Object} connectionData 連接數據
     */
    function createConnectionLine(connectionData) {
        const sourceNode = workflowData.nodes.find(n => n.id === connectionData.source);
        const targetNode = workflowData.nodes.find(n => n.id === connectionData.target);

        if (!sourceNode || !targetNode) return;

        // 獲取起始和結束節點的位置
        const sourceNodeEl = document.querySelector(`.node-wrapper[data-id="${sourceNode.id}"]`);
        const targetNodeEl = document.querySelector(`.node-wrapper[data-id="${targetNode.id}"]`);

        if (!sourceNodeEl || !targetNodeEl) return;

        // 獲取連接點的相對位置
        const outputPoint = sourceNodeEl.querySelector('.connection-point.output');
        const inputPoint = targetNodeEl.querySelector('.connection-point.input');

        // 計算連接線的起點和終點
        const startRect = outputPoint.getBoundingClientRect();
        const endRect = inputPoint.getBoundingClientRect();

        const startX = startRect.left + startRect.width / 2 - canvasOffset.x;
        const startY = startRect.top + startRect.height / 2 - canvasOffset.y;
        const endX = endRect.left + endRect.width / 2 - canvasOffset.x;
        const endY = endRect.top + endRect.height / 2 - canvasOffset.y;

        // 計算控制點的偏移量
        const offsetX = Math.abs(endX - startX) * 0.5;

        // 創建連接線元素
        const connectionLine = document.createElement('svg');
        connectionLine.className = 'connection-line';
        connectionLine.setAttribute('data-id', connectionData.id);
        connectionLine.setAttribute('data-source', connectionData.source);
        connectionLine.setAttribute('data-target', connectionData.target);
        connectionLine.setAttribute('width', canvas.clientWidth);
        connectionLine.setAttribute('height', canvas.clientHeight);
        connectionLine.innerHTML = `
            <path d="M${startX},${startY} C${startX + offsetX},${startY} ${endX - offsetX},${endY} ${endX},${endY}"
                  stroke="#aaa"
                  stroke-width="2"
                  fill="none" />
        `;

        // 將連接線添加到畫布
        canvas.appendChild(connectionLine);
    }

    /**
     * 更新所有連接線
     */
    function updateConnections() {
        // 移除所有現有的連接線
        document.querySelectorAll('.connection-line').forEach(line => {
            line.remove();
        });

        // 重新創建所有連接線
        workflowData.connections.forEach(connection => {
            createConnectionLine(connection);
        });
    }

    /**
     * 開始連接
     * @param {HTMLElement} outputPoint 輸出連接點
     */
    function startConnection(outputPoint) {
        isConnecting = true;
        connectionStartPoint = outputPoint;

        // 標記起始連接點為激活狀態
        outputPoint.classList.add('active');

        // 創建臨時連接線
        const rect = outputPoint.getBoundingClientRect();
        const startX = rect.left + rect.width / 2 - canvasOffset.x;
        const startY = rect.top + rect.height / 2 - canvasOffset.y;

        tempConnectionLine = document.createElement('svg');
        tempConnectionLine.className = 'connection-line';
        tempConnectionLine.setAttribute('width', canvas.clientWidth);
        tempConnectionLine.setAttribute('height', canvas.clientHeight);
        tempConnectionLine.innerHTML = `
            <path d="M${startX},${startY} L${startX},${startY}"
                  stroke="#ff55aa"
                  stroke-width="2"
                  stroke-dasharray="4"
                  fill="none" />
        `;

        // 將臨時連接線添加到畫布
        canvas.appendChild(tempConnectionLine);

        // 高亮顯示所有可能的目標連接點
        document.querySelectorAll('.connection-point.input').forEach(point => {
            // 不要高亮顯示同一節點上的連接點或已連接的連接點
            const parentNode = point.parentElement;
            const outputParentNode = outputPoint.parentElement;

            if (parentNode !== outputParentNode) {
                point.classList.add('highlight');
            }
        });
    }

    /**
     * 更新臨時連接線
     * @param {number} endX 終點X坐標
     * @param {number} endY 終點Y坐標
     */
    function updateTempConnectionLine(endX, endY) {
        const rect = connectionStartPoint.getBoundingClientRect();
        const startX = rect.left + rect.width / 2 - canvasOffset.x;
        const startY = rect.top + rect.height / 2 - canvasOffset.y;

        // 計算控制點的偏移量
        const offsetX = Math.abs(endX - startX) * 0.5;

        // 更新臨時連接線的路徑
        tempConnectionLine.innerHTML = `
            <path d="M${startX},${startY} C${startX + offsetX},${startY} ${endX - offsetX},${endY} ${endX},${endY}"
                  stroke="#ff55aa"
                  stroke-width="2"
                  stroke-dasharray="4"
                  fill="none" />
        `;
    }

    /**
     * 取消連接
     */
    function cancelConnection() {
        if (tempConnectionLine) {
            tempConnectionLine.remove();
            tempConnectionLine = null;
        }

        // 移除連接點的激活狀態
        if (connectionStartPoint) {
            connectionStartPoint.classList.remove('active');
        }

        // 移除所有連接點的高亮顯示
        document.querySelectorAll('.connection-point.highlight, .connection-point.highlight-snap').forEach(point => {
            point.classList.remove('highlight');
            point.classList.remove('highlight-snap');
        });

        isConnecting = false;
        connectionStartPoint = null;
    }

    /**
     * 完成連接
     */
    function finishConnection(e) {
        // 獲取當前鼠標下的高亮吸附點
        const snapPoint = document.querySelector('.connection-point.highlight-snap');

        if (snapPoint) {
            finishConnectionToPoint(snapPoint);
        } else {
            // 檢查是否有連接點在鼠標下方
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            const inputPoint = elements.find(el =>
                el.classList.contains('connection-point') &&
                el.classList.contains('input') &&
                el.parentElement !== connectionStartPoint.parentElement
            );

            if (inputPoint) {
                finishConnectionToPoint(inputPoint);
            } else {
                cancelConnection();
            }
        }
    }

    /**
     * 完成到指定連接點的連接
     * @param {HTMLElement} inputPoint 輸入連接點
     */
    function finishConnectionToPoint(inputPoint) {
        // 獲取起始和結束節點
        const startNodeEl = connectionStartPoint.parentElement;
        const endNodeEl = inputPoint.parentElement;

        if (startNodeEl === endNodeEl) {
            // 不允許連接到同一節點
            cancelConnection();
            return;
        }

        // 創建連接
        createConnection(connectionStartPoint, inputPoint);

        // 移除臨時連接線和高亮顯示
        cancelConnection();

        // 視覺反饋
        inputPoint.classList.add('connected');
        connectionStartPoint.classList.add('connected');

        // 短暫高亮顯示連接線
        const connectionLine = document.querySelector(`.connection-line[data-id="${workflowData.connections[workflowData.connections.length - 1].id}"] path`);
        if (connectionLine) {
            connectionLine.setAttribute('stroke', '#ff55aa');
            setTimeout(() => {
                connectionLine.setAttribute('stroke', '#aaa');
            }, 500);
        }
    }

    /**
     * 顯示節點上下文選單
     * @param {number} x X坐標
     * @param {number} y Y坐標
     * @param {number} nodeId 節點ID
     */
    function showContextMenu(x, y, nodeId) {
        contextMenu.style.display = 'block';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.setAttribute('data-node-id', nodeId);

        // 添加選單項的點擊事件
        document.querySelectorAll('#node-context-menu li').forEach(item => {
            item.onclick = function() {
                const action = this.textContent.toLowerCase().replace(/\s+/g, '-');
                const targetNodeId = parseInt(contextMenu.getAttribute('data-node-id'));

                handleContextMenuAction(action, targetNodeId);
                contextMenu.style.display = 'none';
            };
        });
    }

    /**
     * 處理節點上下文選單動作
     * @param {string} action 動作
     * @param {number} nodeId 節點ID
     */
    function handleContextMenuAction(action, nodeId) {
        switch (action) {
            case 'delete':
                deleteNode(nodeId);
                break;
            case 'run-node':
                runNode(nodeId);
                break;
            case 'set-as-start-node':
                setAsStartNode(nodeId);
                break;
        }
    }

    /**
     * 刪除節點
     * @param {number} nodeId 節點ID
     */
    function deleteNode(nodeId) {
        // 移除節點DOM元素
        const nodeEl = document.querySelector(`.node-wrapper[data-id="${nodeId}"]`);
        if (nodeEl) {
            nodeEl.remove();
        }

        // 移除該節點的所有連接
        workflowData.connections = workflowData.connections.filter(conn =>
            conn.source !== nodeId && conn.target !== nodeId);

        // 移除連接線DOM元素
        updateConnections();

        // 從工作流數據中移除節點
        workflowData.nodes = workflowData.nodes.filter(node => node.id !== nodeId);
    }

    /**
     * 運行節點
     * @param {number} nodeId 節點ID
     */
    function runNode(nodeId) {
        // 添加運行指示器
        const nodeEl = document.querySelector(`.node-wrapper[data-id="${nodeId}"] .node`);
        if (nodeEl) {
            nodeEl.classList.add('running');

            // 模擬運行結果
            setTimeout(() => {
                nodeEl.classList.remove('running');
                nodeEl.classList.add('success');

                // 清除成功指示器
                setTimeout(() => {
                    nodeEl.classList.remove('success');
                }, 1500);
            }, 1000);
        }
    }

    /**
     * 設置為起始節點
     * @param {number} nodeId 節點ID
     */
    function setAsStartNode(nodeId) {
        // 清除其他節點的起始節點標記
        document.querySelectorAll('.node').forEach(node => {
            node.classList.remove('start-node');
        });

        // 標記新的起始節點
        const nodeEl = document.querySelector(`.node-wrapper[data-id="${nodeId}"] .node`);
        if (nodeEl) {
            nodeEl.classList.add('start-node');
        }
    }

    /**
     * 顯示節點選擇器
     * @param {number} x X坐標 (可選)
     * @param {number} y Y坐標 (可選)
     */
    function showNodeSelector(x, y) {
        nodeSelector.style.display = 'block';

        // 如果提供了坐標，設置節點選擇器的位置
        if (x && y) {
            // 計算合適的位置，確保選擇器不會超出視窗範圍
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const selectorWidth = nodeSelector.clientWidth;
            const selectorHeight = nodeSelector.clientHeight;

            if (x + selectorWidth > windowWidth) {
                x = windowWidth - selectorWidth - 10;
            }

            if (y + selectorHeight > windowHeight) {
                y = windowHeight - selectorHeight - 10;
            }

            nodeSelector.style.left = x + 'px';
            nodeSelector.style.top = y + 'px';
            nodeSelector.style.transform = 'none';
        } else {
            // 居中顯示
            nodeSelector.style.left = '50%';
            nodeSelector.style.top = '50%';
            nodeSelector.style.transform = 'translate(-50%, -50%)';
        }
    }

    /**
     * 隱藏節點選擇器
     */
    function hideNodeSelector() {
        nodeSelector.style.display = 'none';
    }

    /**
     * 更新畫布偏移
     */
    function updateCanvasOffset() {
        const rect = canvas.getBoundingClientRect();
        canvasOffset = { x: rect.left, y: rect.top };
    }
});
