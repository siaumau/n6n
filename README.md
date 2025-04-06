# N6N - 簡單工作流編輯器

這是一個簡單的網頁版工作流編輯器，靈感來自 n8n。它允許使用者透過拖放的方式建立節點、連接節點，並設定節點的參數。

目前特別實作了 `HTTP Request` 節點的設定和測試功能，透過內建的後端代理服務來繞過瀏覽器的 CORS 限制。

## 主要功能

*   視覺化拖放介面來建立工作流。
*   新增不同類型的節點 (Webhook, Schedule, HTTP Request 等)。
*   連接節點的輸出和輸入點。
*   雙擊節點開啟設定 Modal。
*   設定 `HTTP Request` 節點的 URL, Method, Headers, Body。
*   **測試 `HTTP Request` 節點**：透過後端代理 (`/backend`) 發送請求並顯示回應。
*   將工作流匯出為 n8n 相容的 JSON 格式。
*   基礎的節點右鍵選單 (刪除、執行模擬、設為開始節點)。

## 技術棧

*   **前端**：HTML, CSS, JavaScript (無框架)
*   **後端 (代理)**：Node.js, Express
*   **HTTP 請求 (後端)**：Axios
*   **CORS 處理 (後端)**：cors

## 安裝與設定

1.  **取得程式碼**：
    ```bash
    # 如果你是使用 git
    git clone <your-repository-url>
    cd <your-repository-directory>
    ```
    (或者直接在你目前的專案目錄下操作)

2.  **設定後端代理服務**：
    ```bash
    # 進入後端目錄
    cd backend

    # 安裝後端所需的 npm 套件
    npm install

    # 回到專案根目錄 (可選)
    cd ..
    ```

## 執行應用程式

你需要同時執行前端和後端。

1.  **執行後端代理伺服器**：
    *   開啟一個終端機。
    *   進入 `backend` 目錄：`cd backend`。
    *   啟動伺服器：`npm start`。
    *   伺服器將會運行在 `http://localhost:3000` (預設)。請保持此終端機開啟。

2.  **執行前端**：
    *   最簡單的方式是使用支援 Live Server 的編輯器 (例如 VS Code 的 Live Server 擴充功能) 直接開啟根目錄下的 `index.html` 檔案。
    *   或者，直接在瀏覽器中開啟 `index.html` 檔案 (但使用 Live Server 可以獲得更好的開發體驗，例如自動重新整理)。

## 使用 HTTP 代理

當你在 `HTTP Request` 節點的設定視窗中點擊「Test Request」按鈕時：

1.  前端會將你輸入的目標 URL (例如 `https://bbc.com/`) 作為參數，發送一個 **GET** 請求到 `http://localhost:3000/proxy`。
2.  運行在本地的後端代理伺服器會接收這個請求，然後代替前端去請求你指定的目標 URL。
3.  代理伺服器將目標伺服器的回應（狀態碼、內容類型、內容本體）回傳給前端。
4.  前端將收到的結果顯示在「Test Result」區域。

這樣就可以繞過瀏覽器的 CORS 限制，測試任意網站的 GET 請求。

## 目前限制

*   後端代理服務目前**僅支援 GET 方法**。
*   前端設定的 Headers 和 Body **不會**透過代理傳遞給目標伺服器。
*   工作流的儲存 (`Save Workflow`) 和載入 (`Load Workflow`) 功能尚未實作。
*   i18n (多國語言) 僅標註了位置，尚未實作切換功能。

## 未來可能的改進

*   增強後端代理以支援 POST, PUT, DELETE 等方法，並能傳遞 Headers 和 Body。
*   實作工作流的儲存與載入功能 (例如使用 LocalStorage 或後端資料庫)。
*   引入 i18n 函式庫並加入多語言翻譯。
*   增加更多節點類型及其設定。
*   優化連線的繪製與互動。
*   實作工作流的實際執行邏輯，而不僅是模擬。
