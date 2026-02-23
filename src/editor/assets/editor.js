// @ts-nocheck
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// @ts-ignore - monaco is loaded via AMD and not available at compile time
/* global monaco */
// aiwebengine Editor - Main JavaScript

/**
 * @typedef {Object} ScriptData
 * @property {string} uri
 * @property {string} content
 * @property {boolean} privileged
 * @property {boolean} [defaultPrivileged]
 * @property {string[]} owners
 * @property {boolean} [isOwner]
 * @property {number} [ownerCount]
 * @property {string} [displayName]
 * @property {number} [size]
 */

/**
 * @typedef {Object} SecurityProfile
 * @property {boolean} privileged
 * @property {boolean} [defaultPrivileged]
 * @property {string[]} [owners]
 * @property {boolean} [isOwner]
 * @property {number} [ownerCount]
 */

class AIWebEngineEditor {
  constructor() {
    /** @type {string | null} */
    this.currentScript = null;
    /** @type {string | null} */
    this.currentAsset = null;
    /** @type {ScriptData[]} */
    this.scriptsData = [];
    /** @type {Object.<string, SecurityProfile>} */
    this.scriptSecurityProfiles = {};
    /** @type {any} */
    this.monacoEditor = null;
    /** @type {any} */
    this.monacoAssetEditor = null;
    /** @type {Object.<string, Function>} */
    this.templates = {};
    this.monacoEditor = null;
    this.monacoAssetEditor = null;
    this.templates = {};
    this.scriptSecurityProfiles = {};
    this.permissions = { canTogglePrivileged: false };
    this.currentFilter = "all";
    this.scriptsData = [];
    this.currentUserId = null;

    // AI Assistant session management
    /** @type {{id: string, turnCount: number, messages: any[], maxTurns: number} | null} */
    this.currentAISession = null;
    /** @type {{toolName: string, toolInput: any, toolUseId: string} | null} */
    this.pendingToolExecution = null;

    this.init();
  }

  // ============================================================================
  // Helper Utilities for Type-Safe DOM Access
  // ============================================================================

  /**
   * Get element by ID with null check
   * @param {string} id
   * @returns {HTMLElement | null}
   */
  getElement(id) {
    return document.getElementById(id);
  }

  /**
   * Get button element by ID
   * @param {string} id
   * @returns {HTMLButtonElement | null}
   */
  getButton(id) {
    return /** @type {HTMLButtonElement | null} */ (
      document.getElementById(id)
    );
  }

  /**
   * Get input element by ID
   * @param {string} id
   * @returns {HTMLInputElement | null}
   */
  getInput(id) {
    return /** @type {HTMLInputElement | null} */ (document.getElementById(id));
  }

  /**
   * Get select element by ID
   * @param {string} id
   * @returns {HTMLSelectElement | null}
   */
  getSelect(id) {
    return /** @type {HTMLSelectElement | null} */ (
      document.getElementById(id)
    );
  }

  /**
   * Get input value by ID
   * @param {string} id
   * @returns {string}
   */
  getValue(id) {
    const input = this.getInput(id);
    return input ? input.value : "";
  }

  /**
   * Set input value by ID
   * @param {string} id
   * @param {string} value
   */
  setValue(id, value) {
    const input = this.getInput(id);
    if (input) {
      input.value = value;
    }
  }

  /**
   * Set text content safely
   * @param {string} id
   * @param {string} text
   */
  setText(id, text) {
    const elem = this.getElement(id);
    if (elem) {
      elem.textContent = text;
    }
  }

  /**
   * Set disabled state on button
   * @param {string} id
   * @param {boolean} disabled
   */
  setDisabled(id, disabled) {
    const btn = this.getButton(id);
    if (btn) {
      btn.disabled = disabled;
    }
  }

  /**
   * Add event listener with null check
   * @param {string} id
   * @param {string} event
   * @param {EventListener} handler
   */
  addListener(id, event, handler) {
    const elem = this.getElement(id);
    if (elem) {
      elem.addEventListener(event, handler);
    }
  }

  /**
   * Set element display style
   * @param {string} id
   * @param {string} display
   */
  setDisplay(id, display) {
    const elem = this.getElement(id);
    if (elem) {
      elem.style.display = display;
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async init() {
    console.log("[Editor] Starting initialization...");
    this.compileTemplates();
    console.log("[Editor] Templates compiled");
    this.setupEventListeners();
    this.renderScriptSecurity(null);
    console.log("[Editor] Event listeners set up");
    await this.setupMonacoEditor();
    console.log("[Editor] Monaco editor ready");
    this.loadInitialData();
    console.log("[Editor] Loading initial data...");

    // Auto-refresh logs every 5 seconds, but only when the Logs tab is active
    setInterval(() => {
      if (document.getElementById("logs-tab")?.classList.contains("active")) {
        this.loadLogs();
      }
    }, 5000);
  }

  compileTemplates() {
    // Using plain JavaScript template functions instead of Handlebars
    this.templates = {
      /** @param {any} data */
      "script-item": (data) => {
        const ownerClass =
          data.ownerCount === 0
            ? "system-script"
            : data.isOwner
              ? "owned"
              : "unowned";
        const ownerBadge =
          data.ownerCount === 0
            ? '<span class="owner-badge system">SYSTEM</span>'
            : data.isOwner
              ? '<span class="owner-badge">MINE</span>'
              : "";
        return `
          <div class="script-item ${data.active ? "active" : ""} ${ownerClass}" data-script="${data.uri}" data-owner-count="${data.ownerCount}" data-is-owner="${data.isOwner}" title="${data.uri}">
            <div class="script-icon">📄</div>
            <div class="script-info">
              <div class="script-item-header">
                <div class="script-item-name">${data.displayName}</div>
                <div class="script-item-badges">
                  ${ownerBadge}
                  <span class="privileged-pill ${data.privileged ? "privileged" : "restricted"}">
                    ${data.privileged ? "P" : "R"}
                  </span>
                </div>
              </div>
              <div class="script-meta">
                <span class="script-size">${data.size} bytes</span>
                ${data.ownerCount > 0 ? `<span class="script-owners">👥 ${data.ownerCount}</span>` : ""}
              </div>
            </div>
          </div>
        `;
      },
      /** @param {any} data */
      "asset-item": (data) => `
        <div class="asset-item ${data.active ? "active" : ""}" data-path="${data.uri}" title="${data.uri}">
          <div class="asset-icon">${data.icon}</div>
          <div class="asset-info">
            <div class="asset-name">${data.displayName}</div>
            <div class="asset-meta">${data.isText ? "text" : "binary"} • ${data.size}</div>
          </div>
        </div>
      `,
      /** @param {any} data */
      "secret-item": (data) => `
        <div class="secret-item ${data.active ? "active" : ""}" data-key="${data.key}" title="${data.key}">
          <div class="secret-icon">🔑</div>
          <div class="secret-info">
            <div class="secret-name">${data.key}</div>
            <div class="secret-meta">Encrypted secret</div>
          </div>
        </div>
      `,
      /** @param {any} data */
      "log-entry": (data) => `
        <div class="log-entry log-${data.level}">
          <span class="log-time">${data.time}</span>
          <span class="log-level">${data.level}</span>
          <span class="log-message">${data.message}</span>
        </div>
      `,
      /** @param {any} data */
      "route-item": (data) => `
        <div class="route-item">
          <div class="route-method ${data.method}">${data.method}</div>
          <div class="route-path">${data.path}</div>
          <div class="route-handler">
            <div class="handler-function">${data.handler}</div>
            <div class="handler-script">${data.script_uri || ""}</div>
          </div>
          <div class="route-actions">
            <button class="btn btn-small btn-secondary test-btn" data-path="${data.path}" data-method="${data.method}">Test</button>
          </div>
        </div>
      `,
    };
    console.log("[Editor] Templates compiled (using plain JS)");
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (target && target.dataset.tab) {
          this.switchTab(target.dataset.tab);
        }
      });
    });

    // Script management
    this.addListener("new-script-btn", "click", () => this.createNewScript());
    this.addListener("save-script-btn", "click", () =>
      this.saveCurrentScript(),
    );
    this.addListener("delete-script-btn", "click", () =>
      this.deleteCurrentScript(),
    );
    this.addListener("toggle-privileged-btn", "click", () =>
      this.togglePrivilegedFlag(),
    );
    this.addListener("manage-owners-btn", "click", () =>
      this.showManageOwnersModal(),
    );

    const scriptsFilter = this.getSelect("scripts-filter-select");
    if (scriptsFilter) {
      scriptsFilter.addEventListener("change", (e) => {
        const target = /** @type {HTMLSelectElement} */ (e.target);
        if (target) {
          this.filterScripts(target.value);
        }
      });
    }

    // Asset management - script selector
    const assetsScriptSelect = this.getSelect("assets-script-select");
    if (assetsScriptSelect) {
      assetsScriptSelect.addEventListener("change", (e) => {
        const target = /** @type {HTMLSelectElement} */ (e.target);
        if (target) {
          this.selectedAssetScript = target.value;
          this.currentAsset = null; // Clear current asset when switching scripts
          // Reset the asset editor view
          this.clearAssetEditor();
          this.loadAssets();
        }
      });
    }

    // Secret management - script selector
    const secretsScriptSelect = this.getSelect("secrets-script-select");
    if (secretsScriptSelect) {
      secretsScriptSelect.addEventListener("change", (e) => {
        const target = /** @type {HTMLSelectElement} */ (e.target);
        if (target) {
          this.selectedSecretScript = target.value;
          this.currentSecret = null; // Clear current secret when switching scripts
          this.clearSecretEditor();
          this.loadSecrets();
        }
      });
    }

    // Asset management
    this.addListener("new-asset-btn", "click", () => this.createNewAsset());
    this.addListener("upload-asset-btn", "click", () =>
      this.triggerAssetUpload(),
    );

    // Secret management
    this.addListener("new-secret-btn", "click", () => this.createNewSecret());
    this.addListener("save-secret-btn", "click", () => this.saveSecret());
    this.addListener("delete-secret-btn", "click", () => this.deleteSecret());

    const assetUpload = this.getInput("asset-upload");
    if (assetUpload) {
      assetUpload.addEventListener("change", (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        if (target && target.files) {
          this.uploadAssets(target.files);
        }
      });
    }

    this.addListener("save-asset-btn", "click", () => this.saveCurrentAsset());
    this.addListener("delete-asset-btn", "click", () =>
      this.deleteCurrentAsset(),
    );

    // Logs - Jump to Latest (guarded event listeners)
    this.addListener("refresh-logs-btn", "click", () =>
      this.jumpToLatestLogs(),
    );
    this.addListener("clear-logs-btn", "click", () => this.clearLogs());

    // Routes
    this.addListener("refresh-routes-btn", "click", () => this.loadRoutes());

    // Test endpoint
    this.addListener("test-endpoint-btn", "click", () => this.testEndpoint());

    // AI Assistant
    this.addListener("toggle-ai-assistant", "click", () =>
      this.toggleAIAssistant(),
    );
    this.addListener("submit-prompt-btn", "click", () => this.submitAIPrompt());
    this.addListener("clear-prompt-btn", "click", () => this.clearAIPrompt());

    // Allow Enter key to submit (Shift+Enter for new line)
    const aiPrompt = this.getElement("ai-prompt");
    if (aiPrompt) {
      aiPrompt.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.submitAIPrompt();
        }
      });
    }

    // Diff modal controls
    this.addListener("close-diff-modal", "click", () => this.closeDiffModal());
    this.addListener("reject-changes-btn", "click", () =>
      this.closeDiffModal(),
    );
    this.addListener("apply-changes-btn", "click", () =>
      this.applyPendingChange(),
    );
  }

  /** @returns {Promise<void>} */
  async setupMonacoEditor() {
    // Load Monaco Editor
    return new Promise((resolve) => {
      // @ts-ignore - require is loaded via AMD script tag
      require.config({
        paths: { vs: "https://unpkg.com/monaco-editor@0.45.0/min/vs" },
      });

      // @ts-ignore - AMD require is loaded via script tag
      require(["vs/editor/editor.main"], () => {
        // Configure TypeScript compiler options for JSX/TSX support
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES2020,
          allowNonTsExtensions: true,
          moduleResolution:
            monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          noEmit: true,
          esModuleInterop: true,
          jsx: monaco.languages.typescript.JsxEmit.React,
          reactNamespace: "React",
          allowJs: true,
          checkJs: false,
          allowSyntheticDefaultImports: true,
          lib: ["ES2020", "DOM"],
          strict: false,
          noImplicitAny: false,
          strictNullChecks: false,
          noUnusedLocals: false,
          noUnusedParameters: false,
        });

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES2020,
          allowNonTsExtensions: true,
          moduleResolution:
            monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          noEmit: true,
          esModuleInterop: true,
          jsx: monaco.languages.typescript.JsxEmit.React,
          reactNamespace: "React",
          allowJs: true,
          checkJs: false,
          allowSyntheticDefaultImports: true,
          lib: ["ES2020", "DOM"],
          strict: false,
          noImplicitAny: false,
          strictNullChecks: false,
          noUnusedLocals: false,
          noUnusedParameters: false,
          skipLibCheck: true,
        });

        // Add extra libraries for better IntelliSense (optional, can help with globals)
        const libSource = `
declare var console: Console;
declare var routeRegistry: any;
declare var require: any;
declare var exports: any;
declare var module: any;
`;
        monaco.languages.typescript.javascriptDefaults.addExtraLib(
          libSource,
          "ts:filename/globals.d.ts",
        );
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          libSource,
          "ts:filename/globals.d.ts",
        );

        // Configure diagnostics to be more lenient for the engine environment
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          diagnosticCodesToIgnore: [
            1308, // 'await' expressions are only allowed at the top level of a file
            2304, // Cannot find name
            2307, // Cannot find module
            2322, // Type 'x' is not assignable to type 'y'
            2339, // Property does not exist on type
            2345, // Argument of type 'x' is not assignable to parameter of type 'y'
            2532, // Object is possibly 'undefined'
            2554, // Expected N arguments, but got M
            2580, // Cannot find name 'require'
            2686, // 'React' refers to a UMD global
            2693, // 'React' only refers to a type, but is being used as a value here
            6133, // Variable is declared but never used
            7016, // Could not find a declaration file for module
            7027, // Unreachable code detected
          ],
        });

        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          diagnosticCodesToIgnore: [
            1308, // 'await' expressions are only allowed at the top level of a file
            2304, // Cannot find name
            2307, // Cannot find module
            2322, // Type 'x' is not assignable to type 'y'
            2339, // Property does not exist on type
            2345, // Argument of type 'x' is not assignable to parameter of type 'y'
            2532, // Object is possibly 'undefined'
            2554, // Expected N arguments, but got M
            2580, // Cannot find name 'require'
            2686, // 'React' refers to a UMD global
            2693, // 'React' only refers to a type, but is being used as a value here
            6133, // Variable is declared but never used
            7016, // Could not find a declaration file for module
            7027, // Unreachable code detected
          ],
        });

        // @ts-ignore - monaco is global from AMD module
        // Script editor
        this.monacoEditor = monaco.editor.create(
          document.getElementById("monaco-editor"),
          {
            value: "// Select a script to edit",
            language: "javascript",
            theme: "vs-dark",
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on",
          },
        );

        this.monacoEditor.onDidChangeModelContent(() => {
          this.updateSaveButton();
        });

        // Asset editor
        // @ts-ignore - monaco is global from AMD module
        this.monacoAssetEditor = monaco.editor.create(
          document.getElementById("monaco-asset-editor"),
          {
            value: "// Select an asset to edit",
            language: "plaintext",
            theme: "vs-dark",
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on",
          },
        );

        this.monacoAssetEditor.onDidChangeModelContent(() => {
          this.updateAssetSaveButton();
        });

        resolve(undefined);
      });
    });
  }

  /**
   * @param {string} tabName
   */
  switchTab(tabName) {
    // Update navigation
    document
      .querySelectorAll(".nav-tab")
      .forEach((tab) => tab.classList.remove("active"));
    const navTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (navTab) {
      navTab.classList.add("active");
    }

    // Update content
    document
      .querySelectorAll(".tab-content")
      .forEach((content) => content.classList.remove("active"));
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
      tabContent.classList.add("active");
    }

    // Load tab-specific data
    switch (tabName) {
      case "scripts":
        this.loadScripts();
        break;
      case "assets":
        this.loadAssets();
        break;
      case "secrets":
        this.loadSecrets();
        break;
      case "logs":
        this.loadLogs();
        break;
      case "routes":
        this.loadRoutes();
        break;
    }
  }

  // Script Management
  async loadScripts() {
    console.log("[Editor] loadScripts() called");
    try {
      const response = await fetch("/api/scripts");
      console.log("[Editor] API response status:", response.status);
      const payload = await response.json();
      const scripts = Array.isArray(payload) ? payload : payload.scripts || [];
      const permissions = Array.isArray(payload)
        ? this.permissions
        : payload.permissions || {};

      this.permissions = {
        canTogglePrivileged: !!permissions.canTogglePrivileged,
      };
      this.scriptSecurityProfiles = {};
      this.scriptsData = scripts;
      console.log("[Editor] Loaded scripts:", scripts);

      scripts.forEach((/** @type {any} */ script) => {
        const scriptUri = script.uri || script.name;
        this.scriptSecurityProfiles[scriptUri] = {
          privileged: !!script.privileged,
          defaultPrivileged: !!script.defaultPrivileged,
          owners: script.owners || [],
          isOwner: !!script.isOwner,
          ownerCount: script.ownerCount || 0,
        };
      });

      this.renderScripts();
      this.renderScriptSecurity(this.currentScript);
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error loading scripts: " + err.message, "error");
    }
  }

  renderScripts() {
    const scriptsList = document.getElementById("scripts-list");
    if (!scriptsList) return;

    scriptsList.innerHTML = "";

    const filteredScripts = this.getFilteredScripts();

    filteredScripts.forEach((/** @type {any} */ script) => {
      const scriptUri = script.uri || script.name;
      const scriptElement = document.createElement("div");
      scriptElement.innerHTML = this.templates["script-item"]({
        uri: scriptUri,
        displayName: script.displayName || scriptUri,
        size: script.size || 0,
        active: scriptUri === this.currentScript,
        privileged: !!script.privileged,
        owners: script.owners || [],
        isOwner: !!script.isOwner,
        ownerCount: script.ownerCount || 0,
      });

      const scriptItem = scriptElement.querySelector(".script-item");
      if (scriptItem) {
        scriptItem.addEventListener("click", () => {
          this.loadScript(scriptUri);
        });
      }

      const firstChild = scriptElement.firstElementChild;
      if (firstChild) {
        scriptsList.appendChild(firstChild);
      }
    });
  }

  getFilteredScripts() {
    switch (this.currentFilter) {
      case "mine":
        return this.scriptsData.filter((s) => s.isOwner);
      case "system":
        return this.scriptsData.filter((s) => s.ownerCount === 0);
      case "unowned":
        return this.scriptsData.filter((s) => s.ownerCount === 0);
      case "all":
      default:
        return this.scriptsData;
    }
  }

  /**
   * @param {string} filter
   */
  filterScripts(filter) {
    this.currentFilter = filter;
    this.renderScripts();
  }

  /**
   * Get Monaco language mode from script name
   * @param {string} scriptName
   * @returns {string}
   */
  getScriptLanguage(scriptName) {
    const ext = scriptName.substring(scriptName.lastIndexOf(".")).toLowerCase();
    const languageMap = {
      ".js": "javascript",
      ".jsx": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
    };
    return languageMap[ext] || "javascript";
  }

  /**
   * @param {string} scriptName
   */
  async loadScript(scriptName) {
    console.log("[Editor] loadScript() called for:", scriptName);
    try {
      const encodedScriptName = encodeURIComponent(scriptName);
      const response = await fetch(`/api/scripts/${encodedScriptName}`);
      console.log("[Editor] loadScript response status:", response.status);
      const content = await response.text();
      console.log("[Editor] Script content length:", content.length);

      this.currentScript = scriptName;
      this.setText("current-script-name", scriptName);

      if (this.monacoEditor) {
        console.log("[Editor] Setting Monaco editor value...");

        // Set the correct language based on file extension
        const language = this.getScriptLanguage(scriptName);
        console.log(
          "[Editor] Detected language:",
          language,
          "for file:",
          scriptName,
        );

        // Get current model
        const currentModel = this.monacoEditor.getModel();

        // Create a new model with the correct language and URI
        // This helps Monaco properly recognize TypeScript files
        // If scriptName is already a URL, use it directly; otherwise use file:// scheme
        let uri;
        try {
          new URL(scriptName);
          // scriptName is a valid URL, use it as-is
          uri = monaco.Uri.parse(scriptName);
        } catch {
          // scriptName is a path, use file:// scheme
          uri = monaco.Uri.parse(`file:///${scriptName}`);
        }
        const newModel = monaco.editor.createModel(content, language, uri);

        // Dispose old model and set new one
        if (currentModel) {
          currentModel.dispose();
        }
        this.monacoEditor.setModel(newModel);

        console.log("[Editor] Created new model with language:", language);

        this.updateSaveButton();
      } else {
        console.error("[Editor] Monaco editor not available!");
      }

      // Update active state in list
      document.querySelectorAll(".script-item").forEach((item) => {
        const htmlItem = /** @type {HTMLElement} */ (item);
        htmlItem.classList.toggle(
          "active",
          htmlItem.dataset.script === scriptName,
        );
      });

      this.setDisabled("delete-script-btn", false);

      this.renderScriptSecurity(scriptName);
      this.renderScriptOwnership(scriptName);
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error loading script: " + err.message, "error");
    }
  }

  createNewScript() {
    const scriptName = prompt("Enter script name (without .js extension):");
    if (!scriptName) return;

    const fullName = scriptName.endsWith(".js")
      ? scriptName
      : scriptName + ".js";

    // Create empty script with proper init() pattern
    const encodedScriptName = encodeURIComponent(fullName);
    fetch(`/api/scripts/${encodedScriptName}`, {
      method: "POST",
      body: `// ${fullName}
// New script created at ${new Date().toISOString()}

function handler(req) {
    return {
        status: 200,
        body: 'Hello from ${fullName}!',
        contentType: 'text/plain; charset=UTF-8'
    };
}

function init(context) {
    console.log('Initializing ${fullName} at ' + new Date().toISOString());
    routeRegistry.registerRoute('/', 'handler', 'GET');
    console.log('${fullName} endpoints registered');
    return { success: true };
}`,
    })
      .then(() => {
        this.loadScripts();
        this.loadScript(fullName);
        this.showStatus("Script created successfully", "success");
      })
      .catch((error) => {
        const err = /** @type {Error} */ (error);
        this.showStatus("Error creating script: " + err.message, "error");
      });
  }

  saveCurrentScript() {
    if (!this.currentScript || !this.monacoEditor) return;

    const content = this.monacoEditor.getValue();
    const encodedScriptName = encodeURIComponent(this.currentScript);

    fetch(`/api/scripts/${encodedScriptName}`, {
      method: "POST",
      body: content,
    })
      .then(() => {
        this.showStatus("Script saved successfully", "success");
        this.updateSaveButton();
      })
      .catch((error) => {
        const err = /** @type {Error} */ (error);
        this.showStatus("Error saving script: " + err.message, "error");
      });
  }

  deleteCurrentScript() {
    if (!this.currentScript) return;

    if (!confirm(`Are you sure you want to delete ${this.currentScript}?`))
      return;

    const encodedScriptName = encodeURIComponent(this.currentScript);
    fetch(`/api/scripts/${encodedScriptName}`, {
      method: "DELETE",
    })
      .then(() => {
        this.currentScript = null;
        this.setText("current-script-name", "No script selected");
        this.setDisabled("delete-script-btn", true);

        if (this.monacoEditor) {
          this.monacoEditor.setValue("// Select a script to edit");
        }

        this.loadScripts();
        this.renderScriptSecurity(null);
        this.showStatus("Script deleted successfully", "success");
      })
      .catch((error) => {
        const err = /** @type {Error} */ (error);
        this.showStatus("Error deleting script: " + err.message, "error");
      });
  }

  updateSaveButton() {
    const hasScript = this.currentScript && this.monacoEditor;
    this.setDisabled("save-script-btn", !hasScript);
  }

  /**
   * @param {string | null} scriptName
   */
  renderScriptSecurity(scriptName) {
    const badge = this.getElement("script-privileged-badge");
    const toggleBtn = this.getButton("toggle-privileged-btn");

    if (!badge || !toggleBtn) {
      return;
    }

    if (!scriptName || !this.scriptSecurityProfiles[scriptName]) {
      badge.textContent = "No script selected";
      badge.className = "privileged-badge neutral";
      toggleBtn.textContent = "Toggle Privileged";
      toggleBtn.disabled = true;
      return;
    }

    const profile = this.scriptSecurityProfiles[scriptName];
    const privileged = !!profile.privileged;

    badge.textContent = privileged ? "Privileged script" : "Restricted script";
    badge.className = `privileged-badge ${privileged ? "privileged" : "restricted"}`;

    if (this.permissions.canTogglePrivileged) {
      toggleBtn.disabled = false;
      toggleBtn.textContent = privileged
        ? "Revoke Privileged Access"
        : "Grant Privileged Access";
    } else {
      toggleBtn.disabled = true;
      toggleBtn.textContent = "Admin only";
    }
  }

  async togglePrivilegedFlag() {
    if (!this.currentScript || !this.permissions.canTogglePrivileged) {
      return;
    }

    const profile = this.scriptSecurityProfiles[this.currentScript];
    const nextValue = !(profile && profile.privileged);
    const encoded = encodeURIComponent(this.currentScript);

    try {
      const response = await fetch(`/api/script-security/${encoded}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ privileged: nextValue }),
      });

      if (!response.ok) {
        let message = `Failed to update privilege (status ${response.status})`;
        try {
          const errorBody = await response.json();
          if (errorBody && errorBody.error) {
            message = errorBody.error;
          }
        } catch (err) {
          console.warn("[Editor] Failed to parse privilege error:", err);
        }
        throw new Error(message);
      }

      if (!this.scriptSecurityProfiles[this.currentScript]) {
        this.scriptSecurityProfiles[this.currentScript] = {
          privileged: nextValue,
          defaultPrivileged: false,
        };
      } else {
        this.scriptSecurityProfiles[this.currentScript].privileged = nextValue;
      }

      this.showStatus(
        `Script ${this.currentScript} is now ${nextValue ? "privileged" : "restricted"}`,
        "success",
      );
      this.renderScriptSecurity(this.currentScript);
      this.loadScripts();
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error updating privilege: " + err.message, "error");
    }
  }

  /**
   * @param {string | null} scriptName
   */
  renderScriptOwnership(scriptName) {
    const ownersList = document.getElementById("script-owners-list");
    const manageBtn = /** @type {HTMLButtonElement | null} */ (
      document.getElementById("manage-owners-btn")
    );

    if (!ownersList || !manageBtn) {
      return;
    }

    if (!scriptName || !this.scriptSecurityProfiles[scriptName]) {
      ownersList.textContent = "-";
      manageBtn.disabled = true;
      return;
    }

    const profile = this.scriptSecurityProfiles[scriptName];
    const owners = profile.owners || [];

    if (owners.length === 0) {
      ownersList.textContent = "System (no owners)";
      manageBtn.disabled = true;
    } else {
      ownersList.textContent = owners.join(", ");
      // Enable manage button if user is owner or admin
      manageBtn.disabled =
        !profile.isOwner && !this.permissions.canTogglePrivileged;
    }
  }

  async showManageOwnersModal() {
    if (!this.currentScript) return;

    const profile = this.scriptSecurityProfiles[this.currentScript];
    const owners = profile.owners || [];

    // Create modal
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Manage Script Owners</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p><strong>Script:</strong> ${this.currentScript}</p>
          <h4>Current Owners</h4>
          <ul class="owner-list" id="owner-list">
            ${
              owners.length === 0
                ? "<li>No owners (system script)</li>"
                : owners
                    .map(
                      (owner) => `
              <li class="owner-item">
                <span class="owner-name">${owner}</span>
                <button class="owner-remove-btn" data-owner="${owner}" ${owners.length === 1 ? 'disabled title="Cannot remove last owner"' : ""}>Remove</button>
              </li>
            `,
                    )
                    .join("")
            }
          </ul>
          <div class="add-owner-section">
            <h4>Add Owner</h4>
            <div class="add-owner-form">
              <input type="text" class="add-owner-input" id="new-owner-input" placeholder="Enter user ID">
              <button class="add-owner-btn" id="add-owner-btn">Add</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelectorAll(".modal-close, .modal-close-btn").forEach((btn) => {
      btn.addEventListener("click", () => modal.remove());
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });

    // Remove owner buttons
    modal.querySelectorAll(".owner-remove-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const owner = target.dataset.owner;
        if (owner) {
          await this.removeScriptOwner(owner);
          modal.remove();
          await this.loadScripts();
          this.renderScriptOwnership(this.currentScript);
        }
      });
    });

    // Add owner button
    const addOwnerBtn = modal.querySelector("#add-owner-btn");
    const newOwnerInput = /** @type {HTMLInputElement | null} */ (
      modal.querySelector("#new-owner-input")
    );

    if (addOwnerBtn && newOwnerInput) {
      addOwnerBtn.addEventListener("click", async () => {
        const newOwner = newOwnerInput.value.trim();
        if (newOwner) {
          await this.addScriptOwner(newOwner);
          modal.remove();
          await this.loadScripts();
          this.renderScriptOwnership(this.currentScript);
        }
      });
    }
  }

  /**
   * @param {string} ownerId
   */
  async addScriptOwner(ownerId) {
    if (!this.currentScript) return;

    try {
      const encodedScript = encodeURIComponent(this.currentScript);
      const response = await fetch(`/api/script-owners/${encodedScript}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId }),
      });

      if (response.ok) {
        this.showStatus(`Added owner: ${ownerId}`, "success");
      } else {
        const error = await response.json();
        this.showStatus(
          `Error: ${error.error || "Failed to add owner"}`,
          "error",
        );
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error adding owner: " + err.message, "error");
    }
  }

  /**
   * @param {string} ownerId
   */
  async removeScriptOwner(ownerId) {
    if (!this.currentScript) return;

    try {
      const encodedScript = encodeURIComponent(this.currentScript);
      const response = await fetch(`/api/script-owners/${encodedScript}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId }),
      });

      if (response.ok) {
        this.showStatus(`Removed owner: ${ownerId}`, "success");
      } else {
        const error = await response.json();
        this.showStatus(
          `Error: ${error.error || "Failed to remove owner"}`,
          "error",
        );
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error removing owner: " + err.message, "error");
    }
  }

  // Asset Management
  clearAssetEditor() {
    this.currentAsset = null;
    this.setText("current-asset-name", "No asset selected");
    this.setDisplay("monaco-asset-editor", "none");
    this.setDisplay("binary-asset-info", "none");
    this.setDisplay("no-asset-selected", "block");
    this.setDisabled("save-asset-btn", true);
    this.setDisabled("delete-asset-btn", true);
  }

  async loadAssets() {
    try {
      const assetsList = document.getElementById("assets-list");
      if (!assetsList) return;

      // Check if a script is selected
      if (!this.selectedAssetScript) {
        assetsList.innerHTML =
          '<div class="no-selection"><p>Select a script to view its assets</p></div>';
        return;
      }

      // Build URL with script URI parameter
      const url = `/api/assets?uri=${encodeURIComponent(this.selectedAssetScript)}`;
      const response = await fetch(url);
      const data = await response.json();

      assetsList.innerHTML = "";

      if (data.assets.length === 0) {
        assetsList.innerHTML =
          '<div class="no-selection"><p>No assets found for this script</p></div>';
        return;
      }

      data.assets.forEach(
        /** @param {any} asset */
        (asset) => {
          const assetElement = document.createElement("div");
          const assetUri = asset.uri || asset.path;
          const isText = this.isTextAsset(assetUri);

          assetElement.innerHTML = this.templates["asset-item"]({
            uri: assetUri,
            displayName: asset.displayName || assetUri,
            size: this.formatBytes(asset.size),
            type: asset.type,
            isText: isText,
            icon: this.getFileIcon(asset.type, isText),
            active: this.currentAsset === assetUri,
          });

          // Add click listener to select asset
          const item = assetElement.firstElementChild;
          if (item) {
            item.addEventListener("click", () => this.selectAsset(assetUri));
            assetsList.appendChild(item);
          }
        },
      );
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error loading assets: " + err.message, "error");
    }
  }

  /**
   * @param {string} path
   */
  isTextAsset(path) {
    const textExtensions = [
      ".css",
      ".svg",
      ".json",
      ".html",
      ".md",
      ".txt",
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".xml",
      ".csv",
      ".yaml",
      ".yml",
      ".toml",
      ".log",
      ".ini",
      ".conf",
      ".config",
    ];
    const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
    return textExtensions.includes(ext);
  }

  /**
   * @param {string} path
   */
  getLanguageMode(path) {
    const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
    /** @type {Record<string, string>} */
    const languageMap = {
      ".css": "css",
      ".svg": "xml",
      ".json": "json",
      ".html": "html",
      ".md": "markdown",
      ".txt": "plaintext",
      ".js": "javascript",
      ".jsx": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".xml": "xml",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".toml": "ini",
      ".log": "plaintext",
      ".ini": "ini",
      ".conf": "plaintext",
      ".config": "plaintext",
    };
    return languageMap[ext] || "plaintext";
  }

  /**
   * @param {string} path
   */
  async selectAsset(path) {
    this.currentAsset = path;

    // Update active state in list
    document.querySelectorAll(".asset-item").forEach((item) => {
      item.classList.remove("active");
    });
    const activeItem = document.querySelector(`[data-path="${path}"]`);
    if (activeItem) {
      activeItem.classList.add("active");
    }

    // Update toolbar
    this.setText("current-asset-name", path);
    this.setDisabled("save-asset-btn", false);
    this.setDisabled("delete-asset-btn", false);

    const isText = this.isTextAsset(path);

    if (isText) {
      // Load text asset in Monaco editor
      try {
        // Build URL with script URI parameter if selected
        let url = `/api/assets/${path}`;
        if (this.selectedAssetScript) {
          url += `?uri=${encodeURIComponent(this.selectedAssetScript)}`;
        }

        const response = await fetch(url);
        const content = await response.text();

        this.monacoAssetEditor.setValue(content);
        const language = this.getLanguageMode(path);
        // @ts-ignore - monaco is loaded via AMD
        // @ts-ignore - monaco is loaded via AMD
        monaco.editor.setModelLanguage(
          this.monacoAssetEditor.getModel(),
          language,
        );

        // Show editor, hide binary info
        this.setDisplay("monaco-asset-editor", "block");
        this.setDisplay("binary-asset-info", "none");
        this.setDisplay("no-asset-selected", "none");
        this.setDisabled("save-asset-btn", false);
      } catch (error) {
        const err = /** @type {Error} */ (error);
        this.showStatus("Error loading asset: " + err.message, "error");
      }
    } else {
      // Binary asset - show info panel
      this.showBinaryAssetInfo(path);
      this.setDisabled("save-asset-btn", true);
    }
  }

  /**
   * @param {string} path
   */
  showBinaryAssetInfo(path) {
    const filename = path.split("/").pop();
    const ext = path.substring(path.lastIndexOf(".")).toLowerCase();

    // Hide editor, show binary info
    this.setDisplay("monaco-asset-editor", "none");
    this.setDisplay("no-asset-selected", "none");
    this.setDisplay("binary-asset-info", "block");

    const detailsDiv = document.getElementById("binary-asset-details");
    if (detailsDiv) {
      detailsDiv.innerHTML = `
        <p><strong>File:</strong> ${filename}</p>
        <p><strong>Path:</strong> ${path}</p>
        <p><strong>Type:</strong> Binary file</p>
        <div class="binary-actions">
          <button class="btn btn-secondary" onclick="window.editor.downloadAsset('${path}')">Download</button>
        </div>
      `;
    }

    const previewDiv = document.getElementById("binary-asset-preview");
    if (previewDiv) {
      previewDiv.innerHTML = "";

      // Show preview for images
      const imageExtensions = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".svg",
      ];
      if (imageExtensions.includes(ext)) {
        previewDiv.innerHTML = `
          <div class="image-preview">
            <img src="/api/assets/${path}" alt="${filename}" style="max-width: 100%; max-height: 400px;">
          </div>
        `;
      }
    }
  }

  createNewAsset() {
    if (!this.selectedAssetScript) {
      this.showStatus("Please select a script first", "error");
      return;
    }

    const filename = prompt("Enter asset filename (e.g., styles/custom.css):");
    if (!filename) return;

    // Ensure it starts with /
    const path = filename.startsWith("/") ? filename : "/" + filename;

    if (!this.isTextAsset(path)) {
      alert(
        "Only text-based assets can be created. Use Upload for binary files.",
      );
      return;
    }

    // Create empty asset
    this.currentAsset = path;
    this.monacoAssetEditor.setValue("");
    const language = this.getLanguageMode(path);
    // @ts-ignore - monaco is loaded via AMD
    // @ts-ignore - monaco is loaded via AMD
    monaco.editor.setModelLanguage(this.monacoAssetEditor.getModel(), language);

    this.setText("current-asset-name", path + " (new)");
    this.setDisplay("monaco-asset-editor", "block");
    this.setDisplay("binary-asset-info", "none");
    this.setDisplay("no-asset-selected", "none");
    this.setDisabled("save-asset-btn", false);
    this.setDisabled("delete-asset-btn", true);

    this.showStatus("Create your asset and click Save", "info");
  }

  async saveCurrentAsset() {
    if (!this.currentAsset) return;
    if (!this.selectedAssetScript) {
      this.showStatus("No script selected for asset", "error");
      return;
    }

    const content = this.monacoAssetEditor.getValue();

    try {
      // Convert content to base64 using UTF-8 safe encoding
      const base64 = this.textToBase64(content);

      // Determine MIME type from extension
      const ext = this.currentAsset
        .substring(this.currentAsset.lastIndexOf("."))
        .toLowerCase();
      /** @type {Record<string, string>} */
      const mimeTypes = {
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".html": "text/html",
        ".md": "text/markdown",
        ".txt": "text/plain",
        ".js": "application/javascript",
        ".xml": "application/xml",
        ".yaml": "text/yaml",
        ".yml": "text/yaml",
      };
      const mimetype = mimeTypes[ext] || "text/plain";

      // Build URL with script URI parameter
      const url = `/api/assets?uri=${encodeURIComponent(this.selectedAssetScript)}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publicPath: this.currentAsset,
          mimetype: mimetype,
          content: base64,
        }),
      });

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}`);
      }

      this.showStatus("Asset saved successfully", "success");

      // Update the display name to remove (new) if it was there
      this.setText("current-asset-name", this.currentAsset);
      this.setDisabled("delete-asset-btn", false);

      // Reload assets list
      this.loadAssets();
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error saving asset: " + err.message, "error");
    }
  }

  async deleteCurrentAsset() {
    if (!this.currentAsset) return;
    if (!this.selectedAssetScript) {
      this.showStatus("No script selected for asset", "error");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${this.currentAsset}?`))
      return;

    try {
      // Build URL with script URI parameter
      const url = `/api/assets/${this.currentAsset}?uri=${encodeURIComponent(this.selectedAssetScript)}`;

      const response = await fetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Delete failed with status ${response.status}: ${errorText}`,
        );
      }

      this.showStatus("Asset deleted successfully", "success");

      // Clear editor using the helper method
      this.clearAssetEditor();

      // Reload assets list
      this.loadAssets();
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error deleting asset: " + err.message, "error");
    }
  }

  updateAssetSaveButton() {
    const saveBtn = /** @type {HTMLButtonElement | null} */ (
      document.getElementById("save-asset-btn")
    );
    if (saveBtn && this.currentAsset && this.isTextAsset(this.currentAsset)) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save *";
    }
  }

  triggerAssetUpload() {
    const uploadInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById("asset-upload")
    );
    if (uploadInput) {
      uploadInput.click();
    }
  }

  /**
   * @param {FileList} files
   */
  async uploadAssets(files) {
    if (!this.selectedAssetScript) {
      this.showStatus("Please select a script first", "error");
      return;
    }

    for (const file of files) {
      try {
        const base64 = await this.fileToBase64(file);
        const publicPath = `/${file.name}`;

        // Build URL with script URI parameter
        const url = `/api/assets?uri=${encodeURIComponent(this.selectedAssetScript)}`;

        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publicPath: publicPath,
            mimetype: file.type,
            content: base64,
          }),
        });

        this.showStatus(`Uploaded ${file.name}`, "success");
      } catch (error) {
        const err = /** @type {Error} */ (error);
        this.showStatus(
          `Error uploading ${file.name}: ${err.message}`,
          "error",
        );
      }
    }

    this.loadAssets();
  }

  /**
   * @param {string} path
   */
  downloadAsset(path) {
    const filename = path.split("/").pop();
    if (!filename) return;

    const isIco = filename.toLowerCase().endsWith(".ico");

    console.log(`Downloading asset: ${path} (isIco: ${isIco})`);

    if (isIco) {
      // For ICO files, use fetch + blob to ensure proper binary handling
      fetch(`/api/assets/${path}`)
        .then((response) => {
          console.log(`Download response status: ${response.status}`);
          if (!response.ok) {
            throw new Error(`Download failed with status ${response.status}`);
          }
          return response.blob();
        })
        .then((blob) => {
          console.log(`Blob size: ${blob.size}, type: ${blob.type}`);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          this.showStatus(`Downloaded ${filename}`, "success");
        })
        .catch((error) => {
          const err = /** @type {Error} */ (error);
          console.error("ICO download failed:", error);
          this.showStatus(`Download failed: ${err.message}`, "error");
          // Fallback to window.open
          window.open(`/api/assets/${path}`, "_blank");
        });
    } else {
      // For other files, use the simple window.open approach
      window.open(`/api/assets/${path}`, "_blank");
    }
  }

  // Secrets Management
  clearSecretEditor() {
    this.currentSecret = null;
    this.setText("current-secret-name", "No secret selected");
    this.setValue("secret-key-input", "");
    this.setValue("secret-value-input", "");
    this.setDisplay("secret-form", "none");
    this.setDisplay("no-secret-selected", "block");
    this.setDisabled("save-secret-btn", true);
    this.setDisabled("delete-secret-btn", true);
  }

  async loadSecrets() {
    try {
      const secretsList = document.getElementById("secrets-list");
      if (!secretsList) return;

      // Check if a script is selected
      if (!this.selectedSecretScript) {
        secretsList.innerHTML =
          '<div class="no-selection"><p>Select a script to view its secrets</p></div>';
        return;
      }

      // Build URL with script URI parameter
      const url = `/api/secrets?uri=${encodeURIComponent(this.selectedSecretScript)}`;
      const response = await fetch(url);
      const data = await response.json();

      secretsList.innerHTML = "";

      if (data.secrets.length === 0) {
        secretsList.innerHTML =
          '<div class="no-selection"><p>No secrets found for this script</p></div>';
        return;
      }

      data.secrets.forEach(
        /** @param {string} key */
        (key) => {
          const secretElement = document.createElement("div");
          secretElement.innerHTML = this.templates["secret-item"]({
            key: key,
            active: this.currentSecret === key,
          });

          // Add click listener to select secret
          const item = secretElement.firstElementChild;
          if (item) {
            item.addEventListener("click", () => this.selectSecret(key));
            secretsList.appendChild(item);
          }
        },
      );
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error loading secrets: " + err.message, "error");
    }
  }

  /**
   * @param {string} key
   */
  selectSecret(key) {
    this.currentSecret = key;
    this.setText("current-secret-name", `Edit: ${key}`);
    this.setValue("secret-key-input", key);
    this.setValue("secret-value-input", ""); // Never show the actual value
    this.setDisplay("secret-form", "block");
    this.setDisplay("no-secret-selected", "none");
    this.setDisabled("save-secret-btn", false);
    this.setDisabled("delete-secret-btn", false);

    // Make key input readonly when editing existing secret
    const keyInput = this.getInput("secret-key-input");
    if (keyInput) {
      keyInput.readOnly = true;
      keyInput.classList.add("readonly");
    }

    // Update help text to clarify editing mode
    const modeText = document.getElementById("secret-form-mode-text");
    if (modeText) {
      modeText.textContent = `Editing secret: ${key}`;
    }
    const valueHelp = document.getElementById("secret-value-help");
    if (valueHelp) {
      valueHelp.textContent =
        "🔒 Enter new value to update this secret (current value is never shown for security)";
    }

    // Update active state in list
    document.querySelectorAll(".secret-item").forEach((item) => {
      item.classList.remove("active");
    });
    const selectedItem = document.querySelector(
      `.secret-item[data-key="${key}"]`,
    );
    if (selectedItem) {
      selectedItem.classList.add("active");
    }

    // Focus on value input since key is readonly
    const valueInput = this.getInput("secret-value-input");
    if (valueInput) {
      valueInput.focus();
    }
  }

  createNewSecret() {
    if (!this.selectedSecretScript) {
      this.showStatus("Please select a script first", "error");
      return;
    }

    this.currentSecret = null;
    this.setText("current-secret-name", "New Secret");
    this.setValue("secret-key-input", "");
    this.setValue("secret-value-input", "");
    this.setDisplay("secret-form", "block");
    this.setDisplay("no-secret-selected", "none");
    this.setDisabled("save-secret-btn", false);
    this.setDisabled("delete-secret-btn", true);

    // Make key input editable when creating new secret
    const keyInput = this.getInput("secret-key-input");
    if (keyInput) {
      keyInput.readOnly = false;
      keyInput.classList.remove("readonly");
      keyInput.focus();
    }

    // Update help text to clarify creation mode
    const modeText = document.getElementById("secret-form-mode-text");
    if (modeText) {
      modeText.textContent = "✨ Create a new secret";
    }
    const valueHelp = document.getElementById("secret-value-help");
    if (valueHelp) {
      valueHelp.textContent =
        "⚠️ This value will be encrypted and never displayed after saving";
    }

    // Clear active state in list
    document.querySelectorAll(".secret-item").forEach((item) => {
      item.classList.remove("active");
    });
  }

  async saveSecret() {
    try {
      const key = this.getValue("secret-key-input");
      const value = this.getValue("secret-value-input");

      if (!key || !value) {
        this.showStatus("Both key and value are required", "error");
        return;
      }

      if (!this.selectedSecretScript) {
        this.showStatus("No script selected", "error");
        return;
      }

      // Validate key format (alphanumeric, underscore, hyphen)
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        this.showStatus(
          "Key must contain only letters, numbers, underscores, and hyphens",
          "error",
        );
        return;
      }

      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uri: this.selectedSecretScript,
          key: key,
          value: value,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        this.showStatus(`Secret '${key}' saved successfully`, "success");
        this.currentSecret = key;
        this.loadSecrets();
        // Clear the value input for security
        this.setValue("secret-value-input", "");
      } else {
        this.showStatus(`Error: ${result.error}`, "error");
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error saving secret: " + err.message, "error");
    }
  }

  async deleteSecret() {
    if (!this.currentSecret) {
      this.showStatus("No secret selected", "error");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete the secret "${this.currentSecret}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/secrets/${encodeURIComponent(this.currentSecret)}?uri=${encodeURIComponent(this.selectedSecretScript)}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (response.ok) {
        this.showStatus(
          `Secret '${this.currentSecret}' deleted successfully`,
          "success",
        );
        this.clearSecretEditor();
        this.loadSecrets();
      } else {
        this.showStatus(`Error: ${result.error}`, "error");
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error deleting secret: " + err.message, "error");
    }
  }

  async populateSecretsScriptSelector() {
    try {
      const response = await fetch("/api/scripts");
      const data = await response.json();

      const selector = this.getSelect("secrets-script-select");
      if (!selector) return;

      // Clear existing options except the first placeholder
      selector.innerHTML = '<option value="">Select a script...</option>';

      // Check if user has admin privileges (can see all scripts)
      const isAdmin = data.permissions && data.permissions.canTogglePrivileged;

      // Filter scripts based on permissions
      let filteredScripts = data.scripts;
      if (!isAdmin) {
        // Non-admin users only see scripts they own
        filteredScripts = data.scripts.filter(
          /** @param {any} script */ (script) => script.isOwner,
        );
      }

      // Add scripts to selector
      filteredScripts.forEach(
        /** @param {any} script */ (script) => {
          const option = document.createElement("option");
          option.value = script.uri;
          const badge = script.privileged ? " [P]" : " [R]";
          option.textContent = script.displayName + badge;
          selector.appendChild(option);
        },
      );
    } catch (error) {
      const err = /** @type {Error} */ (error);
      console.error("Error populating secrets script selector:", err);
    }
  }

  // Logs Management
  async loadLogs() {
    try {
      const response = await fetch("/api/logs");
      const logs = await response.json();

      const logsContent = document.getElementById("logs-content");
      if (!logsContent) return;

      // Remember if user was at the bottom before refresh
      const wasAtBottom = this.isScrolledToBottom(logsContent);

      logsContent.innerHTML = "";

      // Reverse logs so newest appear at bottom
      logs.reverse().forEach(
        /** @param {any} log */
        (log) => {
          const logElement = document.createElement("div");
          logElement.innerHTML = this.templates["log-entry"]({
            time: new Date(log.timestamp).toLocaleTimeString(),
            level: log.level || "info",
            message: this.escapeHtml(log.message),
          });
          const firstChild = logElement.firstElementChild;
          if (firstChild) {
            logsContent.appendChild(firstChild);
          }
        },
      );

      // Only auto-scroll if user was already at the bottom
      if (wasAtBottom) {
        logsContent.scrollTop = logsContent.scrollHeight;
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error loading logs: " + err.message, "error");
    }
  }

  // Jump to the latest log entry without reloading
  jumpToLatestLogs() {
    const logsContent = document.getElementById("logs-content");
    if (!logsContent) return;

    // Scroll to the bottom of logs
    logsContent.scrollTop = logsContent.scrollHeight;

    // Briefly flash the logs area to indicate action (CSS handles animation)
    logsContent.classList.add("logs-flash");
    setTimeout(() => logsContent.classList.remove("logs-flash"), 500);
  }

  // Helper method to check if element is scrolled to bottom
  /**
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isScrolledToBottom(element) {
    // Consider "at bottom" if within 50px of the bottom
    // This accounts for rounding errors and makes it easier to stay "at bottom"
    const threshold = 50;
    return (
      element.scrollHeight - element.scrollTop - element.clientHeight <
      threshold
    );
  }

  async clearLogs() {
    try {
      this.showStatus("Clearing logs...", "info");
      const response = await fetch("/api/logs", { method: "DELETE" });
      if (response.ok) {
        this.showStatus("Logs pruned successfully", "success");
        // Refresh logs after successful prune
        await this.loadLogs();
      } else {
        /** @type {any} */
        let body = {};
        try {
          body = await response.json();
        } catch (e) {
          /* ignore */
        }
        this.showStatus(
          "Failed to prune logs: " + (body.error || response.statusText),
          "error",
        );
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error pruning logs: " + err.message, "error");
    }
  }

  // Routes Management
  async loadRoutes() {
    try {
      const response = await fetch("/api/routes");
      const routes = await response.json();

      const routesList = document.getElementById("routes-list");
      if (!routesList) return;

      routesList.innerHTML = "";

      if (routes.length === 0) {
        routesList.innerHTML =
          '<div class="no-routes">No routes registered yet</div>';
        return;
      }

      routes.forEach(
        /** @param {any} route */
        (route) => {
          const routeElement = document.createElement("div");
          routeElement.innerHTML = this.templates["route-item"]({
            method: route.method,
            path: route.path,
            handler: route.handler,
            script_uri: route.script_uri,
          });

          // Add event listener for test button
          const testBtn = routeElement.querySelector(".test-btn");
          if (testBtn) {
            testBtn.addEventListener("click", () => {
              this.testRoute(route.path, route.method);
            });
          }

          const firstChild = routeElement.firstElementChild;
          if (firstChild) {
            routesList.appendChild(firstChild);
          }
        },
      );
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus("Error loading routes: " + err.message, "error");
    }
  }

  // Utility Methods
  testEndpoint() {
    const testUrl = prompt("Enter endpoint URL to test:", "/");
    if (!testUrl) return;

    fetch(testUrl)
      .then((response) => response.text())
      .then((data) => {
        alert(`Response: ${data}`);
      })
      .catch((error) => {
        const err = /** @type {Error} */ (error);
        alert(`Error: ${err.message}`);
      });
  }

  /**
   * @param {string} path
   * @param {string} method
   */
  testRoute(path, method) {
    const testUrl = prompt(`Test ${method} ${path}:`, path);
    if (!testUrl) return;

    // For simplicity, we'll do a GET request regardless of the method
    // In a real implementation, you'd want to handle different HTTP methods
    fetch(testUrl)
      .then((response) => response.text())
      .then((data) => {
        alert(`Response from ${method} ${path}:\n${data}`);
      })
      .catch((error) => {
        const err = /** @type {Error} */ (error);
        alert(`Error testing ${method} ${path}: ${err.message}`);
      });
  }

  loadInitialData() {
    this.loadScripts();
    this.populateAssetsScriptSelector();
    this.populateSecretsScriptSelector();
  }

  async populateAssetsScriptSelector() {
    try {
      const response = await fetch("/api/scripts");
      const data = await response.json();

      const selector = this.getSelect("assets-script-select");
      if (!selector) return;

      // Clear existing options except the first placeholder
      selector.innerHTML = '<option value="">Select a script...</option>';

      // Check if user has admin privileges (can see all scripts)
      const isAdmin = data.permissions && data.permissions.canTogglePrivileged;

      // Filter scripts based on permissions
      let filteredScripts = data.scripts;
      if (!isAdmin) {
        // Non-admin users only see scripts they own
        filteredScripts = data.scripts.filter(
          /** @param {any} script */ (script) => script.isOwner,
        );
      }

      // Add scripts to selector
      filteredScripts.forEach(
        /** @param {any} script */ (script) => {
          const option = document.createElement("option");
          option.value = script.uri;
          const badge = script.privileged ? " [P]" : " [R]";
          option.textContent = script.displayName + badge;
          selector.appendChild(option);
        },
      );

      // If current script is set and available, select it
      if (
        this.currentScript &&
        filteredScripts.some(
          /** @param {any} s */ (s) => s.uri === this.currentScript,
        )
      ) {
        selector.value = this.currentScript;
        this.selectedAssetScript = this.currentScript;
        this.loadAssets();
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      console.error("Error populating assets script selector:", err.message);
    }
  }

  /**
   * @param {string} message
   * @param {string} [type]
   */
  showStatus(message, type = "info") {
    const statusElement = document.getElementById("status-message");
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status-${type}`;

    // Clear status after 5 seconds
    setTimeout(() => {
      statusElement.textContent = "Ready";
      statusElement.className = "";
    }, 5000);
  }

  /**
   * @param {File} file
   * @returns {Promise<string>}
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          resolve(result.split(",")[1]);
        } else {
          reject(new Error("FileReader result is not a string"));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  }

  // UTF-8 safe base64 encoding for text content
  /**
   * @param {string} text
   * @returns {string}
   */
  textToBase64(text) {
    // Convert text to UTF-8 bytes using TextEncoder
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(text);

    // Convert bytes to binary string
    let binaryString = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      binaryString += String.fromCharCode(utf8Bytes[i]);
    }

    // Encode to base64
    return btoa(binaryString);
  }

  /**
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * @param {string} type
   * @param {boolean} isText
   * @returns {string}
   */
  getFileIcon(type, isText) {
    // If isText is provided, use that to determine icon
    if (isText !== undefined) {
      if (isText) {
        // Text-based files
        if (type.includes("css")) return "🎨";
        if (type.includes("svg") || type.includes("xml")) return "🖼️";
        if (type.includes("json")) return "📋";
        if (type.includes("html")) return "📄";
        if (type.includes("markdown")) return "📝";
        if (type.includes("javascript")) return "📜";
        return "📄";
      } else {
        // Binary files
        if (type === "image/x-icon") return "⭐";
        if (type.startsWith("image/")) return "🖼️";
        if (type.includes("font")) return "🔤";
        return "📦";
      }
    }

    // Fallback to original logic
    if (type === "image/x-icon") return "⭐";
    if (type.startsWith("image/")) return "🖼️";
    if (type.startsWith("text/")) return "📄";
    if (type.includes("javascript")) return "📜";
    if (type.includes("json")) return "📋";
    return "📁";
  }

  // AI Assistant Methods

  /**
   * Initialize or reset AI session
   */
  initAISession() {
    this.currentAISession = {
      id: crypto.randomUUID(),
      turnCount: 0,
      messages: [],
      maxTurns: 10,
    };
    this.pendingToolExecution = null;
    console.log(`AI Session initialized: ${this.currentAISession.id}`);
  }

  /**
   * Add message to current session
   * @param {string} role - "user" or "assistant"
   * @param {any} content - Message content
   */
  addMessageToSession(role, content) {
    if (!this.currentAISession) {
      this.initAISession();
    }

    if (this.currentAISession) {
      this.currentAISession.messages.push({ role, content });

      if (role === "user") {
        this.currentAISession.turnCount++;
      }
    }
  }

  /**
   * Check if turn limit is reached
   * @returns {boolean}
   */
  isTurnLimitReached() {
    if (!this.currentAISession) return false;
    return this.currentAISession.turnCount >= this.currentAISession.maxTurns;
  }

  /**
   * Get turn counter display text
   * @returns {string}
   */
  getTurnCounterText() {
    if (!this.currentAISession) return "";
    return `Turn ${this.currentAISession.turnCount}/${this.currentAISession.maxTurns}`;
  }

  toggleAIAssistant() {
    const aiAssistant = document.querySelector(".ai-assistant");
    const toggleBtn = document.getElementById("toggle-ai-assistant");

    if (!aiAssistant || !toggleBtn) return;

    aiAssistant.classList.toggle("collapsed");

    if (aiAssistant.classList.contains("collapsed")) {
      toggleBtn.textContent = "▲";
    } else {
      toggleBtn.textContent = "▼";
    }
  }

  async submitAIPrompt() {
    const promptInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById("ai-prompt")
    );
    const responseDiv = document.getElementById("ai-response");
    const submitBtn = /** @type {HTMLButtonElement | null} */ (
      document.getElementById("submit-prompt-btn")
    );

    if (!promptInput || !responseDiv || !submitBtn) return;

    const prompt = promptInput.value.trim();

    if (!prompt) {
      this.showStatus("Please enter a prompt", "error");
      return;
    }

    // Initialize session if needed
    if (!this.currentAISession) {
      this.initAISession();
    }

    // Check turn limit
    if (this.isTurnLimitReached()) {
      this.showStatus("Turn limit reached. Start a new session.", "error");
      responseDiv.innerHTML = `
        <div class="ai-response-content">
          <p style="color: var(--warning-color);"><strong>Turn Limit Reached</strong></p>
          <p>You've reached the maximum of ${this.currentAISession?.maxTurns} turns in this conversation.</p>
          <button class="btn btn-primary" onclick="window.editor.startNewAISession()">Start New Session</button>
        </div>
      `;
      return;
    }

    // Clear input and disable button
    promptInput.value = "";
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";

    // Show loading state
    responseDiv.innerHTML =
      '<p class="ai-placeholder">🤖 Processing your request...</p>';
    responseDiv.classList.add("loading");

    try {
      await this.sendAIPromptWithTools(prompt);
    } catch (error) {
      const err = /** @type {Error} */ (error);
      responseDiv.classList.remove("loading");
      responseDiv.innerHTML = `
        <p style="color: var(--danger-color);">
          <strong>Error:</strong> ${this.escapeHtml(err.message)}
        </p>
      `;
      this.showStatus("Failed to get AI response", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }

  /**
   * Send prompt using the new tool calling API
   * @param {string} userPrompt
   */
  async sendAIPromptWithTools(userPrompt) {
    const responseDiv = document.getElementById("ai-response");
    if (!responseDiv || !this.currentAISession) return;

    // Include current context in the user message
    let contextualContent = userPrompt;
    if (this.currentScript && this.monacoEditor) {
      const content = this.monacoEditor.getValue();
      contextualContent += `\n\nCurrent Script: ${this.currentScript}\n\`\`\`javascript\n${content}\n\`\`\``;
    } else if (
      this.currentAsset &&
      this.monacoAssetEditor &&
      this.isTextAsset(this.currentAsset)
    ) {
      const content = this.monacoAssetEditor.getValue();
      contextualContent += `\n\nCurrent Asset: ${this.currentAsset}\n\`\`\`\n${content}\n\`\`\``;
    }

    // Add user message to session
    this.addMessageToSession("user", contextualContent);

    // Call the API
    const response = await fetch("/api/ai-assistant/tools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: this.currentAISession.id,
        messages: this.currentAISession.messages,
        currentScript: this.currentScript,
        currentAsset: this.currentAsset,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log("AI Response data:", data);
    console.log("data.tool_uses:", data.tool_uses);

    // Add assistant response to session
    const assistantContent = [];
    if (data.text) {
      assistantContent.push({ type: "text", text: data.text });
    }
    if (data.tool_uses) {
      for (const toolUse of data.tool_uses) {
        assistantContent.push({
          type: "tool_use",
          id: toolUse.tool_use_id,
          name: toolUse.tool_name,
          input: toolUse.tool_input,
        });
      }
    }
    this.addMessageToSession("assistant", assistantContent);

    // Display the response
    responseDiv.classList.remove("loading");

    console.log("data.needs_confirmation:", data.needs_confirmation);
    console.log("Checking tool_uses length:", data.tool_uses?.length);

    if (
      data.needs_confirmation &&
      data.tool_uses &&
      data.tool_uses.length > 0
    ) {
      console.log("Taking showToolConfirmation path");
      // Show tool confirmation UI
      await this.showToolConfirmation(data.tool_uses[0], data.text);
    } else if (data.tool_uses && data.tool_uses.length > 0) {
      console.log("Taking handleToolExecution path with:", data.tool_uses[0]);
      // Tool was executed, continue conversation if needed
      await this.handleToolExecution(data.tool_uses[0]);
    } else {
      console.log("Taking displayAIMessage path");
      // Just text response
      this.displayAIMessage(data.text, userPrompt);
    }

    this.showStatus("AI response received", "success");
  }

  /**
   * Show tool confirmation modal
   * @param {{tool_use_id: string, tool_name: string, tool_input: any, requires_confirmation: boolean}} toolUse
   * @param {string} aiText
   */
  async showToolConfirmation(toolUse, aiText) {
    const responseDiv = document.getElementById("ai-response");
    if (!responseDiv) return;

    const { tool_name, tool_input, tool_use_id } = toolUse;

    // Store for later execution
    this.pendingToolExecution = {
      toolName: tool_name,
      toolInput: tool_input,
      toolUseId: tool_use_id,
    };

    let html = `
      <div class="ai-response-content">
        <p><strong>🛠️ Tool Request:</strong> ${tool_name.replace(/_/g, " ").toUpperCase()}</p>
        ${aiText ? `<p>${this.escapeHtml(aiText)}</p>` : ""}
        <hr style="border-color: var(--border-color); margin: 10px 0;">
    `;

    // Show tool details based on type
    if (tool_name === "edit_script" || tool_name === "create_script") {
      html += `
        <p><strong>Script:</strong> <code>${this.escapeHtml(tool_input.script_name)}</code></p>
        <p><strong>Message:</strong> ${this.escapeHtml(tool_input.message)}</p>
        <div class="ai-code-preview">
          <pre><code>${this.escapeHtml(tool_input.code.substring(0, 300))}${tool_input.code.length > 300 ? "..." : ""}</code></pre>
        </div>
        <div class="ai-action-buttons">
          <button class="btn btn-primary" onclick="window.editor.approveToolExecution()">Preview & Approve</button>
          <button class="btn btn-secondary" onclick="window.editor.rejectToolExecution()">Cancel</button>
        </div>
      `;
    } else if (tool_name === "delete_script") {
      html += `
        <p><strong>Script:</strong> <code>${this.escapeHtml(tool_input.script_name)}</code></p>
        <p><strong>Message:</strong> ${this.escapeHtml(tool_input.message)}</p>
        <div class="ai-action-buttons">
          <button class="btn btn-danger" onclick="window.editor.approveToolExecution()">Confirm Delete</button>
          <button class="btn btn-secondary" onclick="window.editor.rejectToolExecution()">Cancel</button>
        </div>
      `;
    } else if (tool_name === "edit_asset" || tool_name === "create_asset") {
      html += `
        <p><strong>Asset:</strong> <code>${this.escapeHtml(tool_input.asset_path)}</code></p>
        <p><strong>Message:</strong> ${this.escapeHtml(tool_input.message)}</p>
        <div class="ai-code-preview">
          <pre><code>${this.escapeHtml(tool_input.code.substring(0, 300))}${tool_input.code.length > 300 ? "..." : ""}</code></pre>
        </div>
        <div class="ai-action-buttons">
          <button class="btn btn-primary" onclick="window.editor.approveToolExecution()">Preview & Approve</button>
          <button class="btn btn-secondary" onclick="window.editor.rejectToolExecution()">Cancel</button>
        </div>
      `;
    } else if (tool_name === "delete_asset") {
      html += `
        <p><strong>Asset:</strong> <code>${this.escapeHtml(tool_input.asset_path)}</code></p>
        <p><strong>Message:</strong> ${this.escapeHtml(tool_input.message)}</p>
        <div class="ai-action-buttons">
          <button class="btn btn-danger" onclick="window.editor.approveToolExecution()">Confirm Delete</button>
          <button class="btn btn-secondary" onclick="window.editor.rejectToolExecution()">Cancel</button>
        </div>
      `;
    }

    html += `
        <p style="color: var(--text-muted); font-size: 11px; margin-top: 10px;">
          ${this.getTurnCounterText()} • ${new Date().toLocaleString()}
        </p>
      </div>
    `;

    responseDiv.innerHTML = html;
  }

  /**
   * Strip CDATA wrapper from content if present
   * @param {string} content
   * @returns {string}
   */
  stripCDATA(content) {
    if (typeof content !== "string") return content;
    // Remove <![CDATA[ prefix and ]]> suffix if present
    return content.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
  }

  /**
   * Approve and execute pending tool
   */
  async approveToolExecution() {
    if (!this.pendingToolExecution) return;

    const { toolName, toolInput } = this.pendingToolExecution;

    // Use existing UI flow for preview/confirmation
    if (toolName === "create_script") {
      await this.showDiffModal(
        toolInput.script_name,
        "",
        this.stripCDATA(toolInput.code),
        toolInput.message,
        "create",
        "script",
      );
    } else if (toolName === "edit_script") {
      await this.showDiffModal(
        toolInput.script_name,
        this.stripCDATA(toolInput.original_code || ""),
        this.stripCDATA(toolInput.code),
        toolInput.message,
        "edit",
        "script",
      );
    } else if (toolName === "delete_script") {
      this.confirmDeleteScript(toolInput.script_name, toolInput.message);
    } else if (toolName === "create_asset") {
      await this.showDiffModal(
        toolInput.asset_path,
        "",
        this.stripCDATA(toolInput.code),
        toolInput.message,
        "create",
        "asset",
      );
    } else if (toolName === "edit_asset") {
      await this.showDiffModal(
        toolInput.asset_path,
        this.stripCDATA(toolInput.original_code || ""),
        this.stripCDATA(toolInput.code),
        toolInput.message,
        "edit",
        "asset",
      );
    } else if (toolName === "delete_asset") {
      this.confirmDeleteAsset(toolInput.asset_path, toolInput.message);
    }

    // Don't clear pendingToolExecution here - it needs to stay available
    // for applyPendingChange() to send the result back to the AI
    // It will be cleared in applyPendingChange() or rejectToolExecution()
  }

  /**
   * Reject pending tool execution
   */
  rejectToolExecution() {
    if (!this.pendingToolExecution || !this.currentAISession) return;

    const { toolUseId } = this.pendingToolExecution;

    // Add tool result with cancellation message
    this.currentAISession.messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: "User cancelled the operation",
        },
      ],
    });

    this.pendingToolExecution = null;

    const responseDiv = document.getElementById("ai-response");
    if (responseDiv) {
      responseDiv.innerHTML = `
        <div class="ai-response-content">
          <p>Operation cancelled. You can ask me to do something else.</p>
        </div>
      `;
    }

    this.showStatus("Operation cancelled", "info");
  }

  /**
   * Handle tool execution (for non-confirmation tools)
   * @param {{tool_use_id: string, tool_name: string, tool_input: any, result: any}} toolExecution
   */
  async handleToolExecution(toolExecution) {
    const responseDiv = document.getElementById("ai-response");
    if (!responseDiv) return;

    // Debug logging
    console.log("handleToolExecution called with:", toolExecution);
    console.log("toolExecution.result:", toolExecution.result);
    console.log(
      "requires_client_action:",
      toolExecution.result?.requires_client_action,
    );

    // Check if tool result requires client action (diff preview, etc.)
    if (toolExecution.result && toolExecution.result.requires_client_action) {
      // Store the tool execution for approval flow
      this.pendingToolExecution = {
        toolName: toolExecution.tool_name,
        toolInput: toolExecution.tool_input,
        toolUseId: toolExecution.tool_use_id,
      };

      // Show the appropriate UI based on tool type
      const { tool_name, tool_input } = toolExecution;

      if (tool_name === "create_script" || tool_name === "edit_script") {
        // Show preview button for script operations
        responseDiv.innerHTML = `
          <div class="ai-response-content">
            <p><strong>✓ Ready:</strong> ${this.escapeHtml(toolExecution.result.message)}</p>
            <div class="ai-action-buttons">
              <button class="btn btn-primary" onclick="window.editor.approveToolExecution()">Preview & Apply</button>
              <button class="btn btn-secondary" onclick="window.editor.rejectToolExecution()">Cancel</button>
            </div>
            <p style="color: var(--text-muted); font-size: 11px; margin-top: 10px;">
              ${this.getTurnCounterText()} • ${new Date().toLocaleString()}
            </p>
          </div>
        `;
      } else if (tool_name === "create_asset" || tool_name === "edit_asset") {
        // Show preview button for asset operations
        responseDiv.innerHTML = `
          <div class="ai-response-content">
            <p><strong>✓ Ready:</strong> ${this.escapeHtml(toolExecution.result.message)}</p>
            <div class="ai-action-buttons">
              <button class="btn btn-primary" onclick="window.editor.approveToolExecution()">Preview & Apply</button>
              <button class="btn btn-secondary" onclick="window.editor.rejectToolExecution()">Cancel</button>
            </div>
            <p style="color: var(--text-muted); font-size: 11px; margin-top: 10px;">
              ${this.getTurnCounterText()} • ${new Date().toLocaleString()}
            </p>
          </div>
        `;
      } else if (
        tool_name === "delete_script" ||
        tool_name === "delete_asset"
      ) {
        // Show confirmation for delete operations
        responseDiv.innerHTML = `
          <div class="ai-response-content">
            <p><strong>⚠️ Confirm:</strong> ${this.escapeHtml(toolExecution.result.message)}</p>
            <div class="ai-action-buttons">
              <button class="btn btn-danger" onclick="window.editor.approveToolExecution()">Confirm Delete</button>
              <button class="btn btn-secondary" onclick="window.editor.rejectToolExecution()">Cancel</button>
            </div>
            <p style="color: var(--text-muted); font-size: 11px; margin-top: 10px;">
              ${this.getTurnCounterText()} • ${new Date().toLocaleString()}
            </p>
          </div>
        `;
      }

      return;
    }

    // For tools without client action requirement, just display the result
    responseDiv.innerHTML = `
      <div class="ai-response-content">
        <p><strong>Tool Executed:</strong> ${toolExecution.tool_name}</p>
        <p>${this.escapeHtml(toolExecution.result.message || "Tool executed successfully")}</p>
        <p style="color: var(--text-muted); font-size: 11px; margin-top: 10px;">
          ${this.getTurnCounterText()} • ${new Date().toLocaleString()}
        </p>
      </div>
    `;
  }

  /**
   * Display a simple AI message
   * @param {string} text
   * @param {string} userPrompt
   */
  displayAIMessage(text, userPrompt) {
    const responseDiv = document.getElementById("ai-response");
    if (!responseDiv) return;

    responseDiv.innerHTML = `
      <div class="ai-response-content">
        <p><strong>You asked:</strong> ${this.escapeHtml(userPrompt)}</p>
        <hr style="border-color: var(--border-color); margin: 10px 0;">
        <div class="ai-response-text">${this.escapeHtml(text)}</div>
        <p style="color: var(--text-muted); font-size: 11px; margin-top: 10px;">
          ${this.getTurnCounterText()} • ${new Date().toLocaleString()}
        </p>
      </div>
    `;
  }

  /**
   * Continue AI conversation after tool execution
   * Sends the current message history back to get the AI's next response
   */
  async continueAIConversation() {
    console.log("continueAIConversation() called");

    if (!this.currentAISession) {
      console.log("No current AI session, aborting");
      return;
    }

    console.log("Current AI session messages:", this.currentAISession.messages);

    const responseDiv = document.getElementById("ai-response");
    if (responseDiv) {
      responseDiv.innerHTML = `
        <div class="ai-response-content loading">
          <p>Processing...</p>
        </div>
      `;
    }

    try {
      console.log("Sending continuation request to /api/ai-assistant/tools");

      const response = await fetch("/api/ai-assistant/tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: this.currentAISession.id,
          messages: this.currentAISession.messages,
          currentScript: this.currentScript,
          currentAsset: this.currentAsset,
        }),
      });

      console.log("Continuation response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Continuation request failed:", errorText);
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        );
      }

      const data = await response.json();
      console.log("Continuation response data:", data);

      // Add assistant response to session
      const assistantContent = [];
      if (data.text) {
        assistantContent.push({ type: "text", text: data.text });
      }
      if (data.tool_uses) {
        for (const toolUse of data.tool_uses) {
          assistantContent.push({
            type: "tool_use",
            id: toolUse.tool_use_id,
            name: toolUse.tool_name,
            input: toolUse.tool_input,
          });
        }
      }
      this.addMessageToSession("assistant", assistantContent);

      // Display the response
      if (responseDiv) {
        responseDiv.classList.remove("loading");
      }

      if (
        data.needs_confirmation &&
        data.tool_uses &&
        data.tool_uses.length > 0
      ) {
        // Show tool confirmation UI
        await this.showToolConfirmation(data.tool_uses[0], data.text);
      } else if (data.tool_uses && data.tool_uses.length > 0) {
        // Tool was executed, handle it
        await this.handleToolExecution(data.tool_uses[0]);
      } else if (data.text) {
        // Just text response
        if (responseDiv) {
          responseDiv.innerHTML = `
            <div class="ai-response-content">
              <div class="ai-response-text">${this.escapeHtml(data.text)}</div>
              <p style="color: var(--text-muted); font-size: 11px; margin-top: 10px;">
                ${this.getTurnCounterText()} • ${new Date().toLocaleString()}
              </p>
            </div>
          `;
        }
      }

      this.showStatus("AI response received", "success");
    } catch (error) {
      const err = /** @type {Error} */ (error);
      console.error("Error continuing AI conversation:", err);
      this.showStatus(`Error: ${err.message}`, "error");

      if (responseDiv) {
        responseDiv.innerHTML = `
          <div class="ai-response-content">
            <p style="color: var(--error-color);">Error: ${this.escapeHtml(err.message)}</p>
            <p>You can try asking something else or start a new session.</p>
          </div>
        `;
      }
    }
  }

  /**
   * Start a new AI session
   */
  startNewAISession() {
    this.initAISession();
    const responseDiv = document.getElementById("ai-response");
    if (responseDiv) {
      responseDiv.innerHTML = `
        <div class="ai-response-content">
          <p style="color: var(--success-color);">✓ New session started</p>
          <p>Ask me anything about creating or modifying scripts and assets.</p>
        </div>
      `;
    }
    this.showStatus("New AI session started", "success");
  }

  async submitAIPromptOld() {
    const promptInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById("ai-prompt")
    );
    const responseDiv = document.getElementById("ai-response");
    const submitBtn = /** @type {HTMLButtonElement | null} */ (
      document.getElementById("submit-prompt-btn")
    );

    if (!promptInput || !responseDiv || !submitBtn) return;

    const prompt = promptInput.value.trim();

    if (!prompt) {
      this.showStatus("Please enter a prompt", "error");
      return;
    }

    // Disable submit button and show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    responseDiv.innerHTML =
      '<p class="ai-placeholder">Processing your request...</p>';
    responseDiv.classList.add("loading");

    try {
      // Include current context (script or asset)
      const requestBody = {
        prompt: prompt,
        currentScript: this.currentScript,
        currentScriptContent: this.monacoEditor
          ? this.monacoEditor.getValue()
          : null,
        currentAsset: this.currentAsset,
        currentAssetContent:
          this.monacoAssetEditor &&
          this.currentAsset &&
          this.isTextAsset(this.currentAsset)
            ? this.monacoAssetEditor.getValue()
            : null,
      };

      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check if response was truncated
      if (data.truncated) {
        console.warn("AI response was truncated due to length");

        // If we have a parse error, show a helpful message
        if (data.parse_error && !data.parsed) {
          responseDiv.classList.remove("loading");
          responseDiv.innerHTML = `
            <div class="ai-response-content">
              <p><strong>⚠️ Response Incomplete</strong></p>
              <p style="color: var(--warning-color);">
                The AI's response was too long and got cut off. The generated code may be incomplete.
              </p>
              <p style="font-size: 12px; color: var(--text-muted);">
                Try asking for a simpler version or breaking your request into smaller parts.
              </p>
              <hr style="border-color: var(--border-color); margin: 10px 0;">
              <div class="ai-response-text">${this.escapeHtml(data.response)}</div>
            </div>
          `;
          this.showStatus("AI response was truncated", "warning");
          return;
        }
      }

      // Check if we got a structured response
      if (data.parsed && data.parsed.type) {
        this.handleStructuredAIResponse(data.parsed, prompt, data.truncated);
      } else {
        // Display plain text response
        this.displayPlainAIResponse(data.response, prompt, data.truncated);
      }

      this.showStatus("AI response received", "success");
    } catch (error) {
      const err = /** @type {Error} */ (error);
      responseDiv.classList.remove("loading");
      responseDiv.innerHTML = `
        <p style="color: var(--danger-color);">
          <strong>Error:</strong> ${this.escapeHtml(err.message)}
        </p>
      `;
      this.showStatus("Failed to get AI response", "error");
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }

  /**
   * @param {string} responseText
   * @param {string} prompt
   * @param {boolean} [truncated]
   */
  displayPlainAIResponse(responseText, prompt, truncated = false) {
    const responseDiv = document.getElementById("ai-response");
    if (!responseDiv) return;

    responseDiv.classList.remove("loading");

    const truncationWarning = truncated
      ? `
      <div style="background: var(--warning-bg, #fff3cd); color: var(--warning-color, #856404); padding: 10px; border-radius: 4px; margin-bottom: 10px;">
        ⚠️ <strong>Note:</strong> The response may have been truncated due to length. Consider asking for a shorter version.
      </div>
    `
      : "";

    responseDiv.innerHTML = `
      <div class="ai-response-content">
        <p><strong>You asked:</strong> ${this.escapeHtml(prompt)}</p>
        <hr style="border-color: var(--border-color); margin: 10px 0;">
        ${truncationWarning}
        <div class="ai-response-text">${this.escapeHtml(responseText)}</div>
        <p style="color: var(--text-muted); font-size: 11px; margin-top: 10px;">
          ${new Date().toLocaleString()}
        </p>
      </div>
    `;
  }

  /**
   * @param {any} parsed
   * @param {string} prompt
   * @param {boolean} [truncated]
   */
  handleStructuredAIResponse(parsed, prompt, truncated = false) {
    const responseDiv = document.getElementById("ai-response");
    if (!responseDiv) return;

    responseDiv.classList.remove("loading");

    const actionType = parsed.type;
    const message = parsed.message || "AI suggestion";
    const scriptName = parsed.script_name || "untitled.js";
    const assetPath = parsed.asset_path || parsed.asset_name || null;
    const code = parsed.code || "";
    const originalCode = parsed.original_code || "";

    // Store the data for button clicks
    this.pendingAIAction = {
      type: actionType,
      scriptName: scriptName,
      assetPath: assetPath,
      code: code,
      originalCode: originalCode,
      message: message,
    };

    const truncationWarning = truncated
      ? `
      <div style="background: var(--warning-bg, #fff3cd); color: var(--warning-color, #856404); padding: 10px; border-radius: 4px; margin-bottom: 10px;">
        ⚠️ <strong>Warning:</strong> The AI response was truncated. The generated code may be incomplete. Please review carefully before applying.
      </div>
    `
      : "";

    let html = `
      <div class="ai-response-content">
        <p><strong>You asked:</strong> ${this.escapeHtml(prompt)}</p>
        <hr style="border-color: var(--border-color); margin: 10px 0;">
        ${truncationWarning}
        <div class="ai-action-header">
          <span class="ai-action-type ai-action-${actionType}">${actionType.replace(/_/g, " ").toUpperCase()}</span>
        </div>
        <p><strong>AI Suggestion:</strong> ${this.escapeHtml(message)}</p>
    `;

    if (actionType === "explanation") {
      // Just show the explanation, no actions needed
      html += `</div>`;
    } else if (actionType === "create_script") {
      html += `
        <p><strong>Script Name:</strong> <code>${this.escapeHtml(scriptName)}</code></p>
        <div class="ai-code-preview">
          <pre><code>${this.escapeHtml(code.substring(0, 300))}${code.length > 300 ? "..." : ""}</code></pre>
        </div>
        <div class="ai-action-buttons">
          <button class="btn btn-success" onclick="window.editor.applyPendingAIAction()">Preview & Create</button>
        </div>
        </div>
      `;
    } else if (actionType === "edit_script") {
      html += `
        <p><strong>Script Name:</strong> <code>${this.escapeHtml(scriptName)}</code></p>
        <div class="ai-action-buttons">
          <button class="btn btn-primary" onclick="window.editor.applyPendingAIAction()">Preview Changes</button>
        </div>
        </div>
      `;
    } else if (actionType === "delete_script") {
      html += `
        <p><strong>Script Name:</strong> <code>${this.escapeHtml(scriptName)}</code></p>
        <div class="ai-action-buttons">
          <button class="btn btn-danger" onclick="window.editor.applyPendingAIAction()">Confirm Delete</button>
        </div>
        </div>
      `;
    } else if (actionType === "create_asset") {
      html += `
        <p><strong>Asset Path:</strong> <code>${this.escapeHtml(assetPath)}</code></p>
        <div class="ai-code-preview">
          <pre><code>${this.escapeHtml(code.substring(0, 300))}${code.length > 300 ? "..." : ""}</code></pre>
        </div>
        <div class="ai-action-buttons">
          <button class="btn btn-success" onclick="window.editor.applyPendingAIAction()">Preview & Create</button>
        </div>
        </div>
      `;
    } else if (actionType === "edit_asset") {
      html += `
        <p><strong>Asset Path:</strong> <code>${this.escapeHtml(assetPath)}</code></p>
        <div class="ai-action-buttons">
          <button class="btn btn-primary" onclick="window.editor.applyPendingAIAction()">Preview Changes</button>
        </div>
        </div>
      `;
    } else if (actionType === "delete_asset") {
      html += `
        <p><strong>Asset Path:</strong> <code>${this.escapeHtml(assetPath)}</code></p>
        <div class="ai-action-buttons">
          <button class="btn btn-danger" onclick="window.editor.applyPendingAIAction()">Confirm Delete</button>
        </div>
        </div>
      `;
    }

    html += `
      <p style="color: var(--text-muted); font-size: 11px; margin-top: 10px;">
        ${new Date().toLocaleString()}
      </p>
    `;

    responseDiv.innerHTML = html;
  }

  async applyPendingAIAction() {
    if (!this.pendingAIAction) {
      this.showStatus("No pending action", "error");
      return;
    }

    const { type, scriptName, assetPath, code, originalCode, message } =
      this.pendingAIAction;

    if (type === "create_script") {
      await this.showDiffModal(
        scriptName,
        "",
        code,
        message,
        "create",
        "script",
      );
    } else if (type === "edit_script") {
      await this.showDiffModal(
        scriptName,
        originalCode || "",
        code,
        message,
        "edit",
        "script",
      );
    } else if (type === "delete_script") {
      this.confirmDeleteScript(scriptName, message);
    } else if (type === "create_asset") {
      await this.showDiffModal(assetPath, "", code, message, "create", "asset");
    } else if (type === "edit_asset") {
      await this.showDiffModal(
        assetPath,
        originalCode || "",
        code,
        message,
        "edit",
        "asset",
      );
    } else if (type === "delete_asset") {
      this.confirmDeleteAsset(assetPath, message);
    }
  }

  /**
   * @param {string} name
   * @param {string} originalCode
   * @param {string} newCode
   * @param {string} explanation
   * @param {string} action
   * @param {string} contentType
   */
  async showDiffModal(
    name,
    originalCode,
    newCode,
    explanation,
    action,
    contentType,
  ) {
    const modal = document.getElementById("diff-modal");
    const title = document.getElementById("diff-modal-title");
    const explanationDiv = document.getElementById("diff-explanation");

    if (!modal || !title || !explanationDiv) return;

    // Set title based on action and type
    const typeLabel = contentType === "asset" ? "Asset" : "Script";
    if (action === "create") {
      title.textContent = `Create ${typeLabel}: ${name}`;
    } else if (action === "edit") {
      title.textContent = `Edit ${typeLabel}: ${name}`;
    }

    explanationDiv.innerHTML = `<p>${this.escapeHtml(explanation)}</p>`;

    // Show modal
    modal.style.display = "flex";

    // Determine language mode based on content type
    let language = "javascript";
    if (contentType === "asset") {
      language = this.getLanguageMode(name);
    }

    // Create diff editor
    await this.createDiffEditor(originalCode || "", newCode, language);

    // Store data for apply action
    this.pendingChange = {
      name: name,
      newCode: newCode,
      action: action,
      contentType: contentType,
    };
  }

  /**
   * @param {string} originalCode
   * @param {string} newCode
   * @param {string} [language]
   * @returns {Promise<void>}
   */
  async createDiffEditor(originalCode, newCode, language = "javascript") {
    const container = document.getElementById("monaco-diff-editor");
    if (!container) return Promise.resolve();

    // Clear any existing content
    container.innerHTML = "";

    return new Promise((resolve) => {
      if (this.monacoDiffEditor) {
        this.monacoDiffEditor.dispose();
      }

      // @ts-ignore - monaco is loaded via AMD
      this.monacoDiffEditor = monaco.editor.createDiffEditor(container, {
        theme: "vs-dark",
        readOnly: true,
        automaticLayout: true,
        renderSideBySide: true,
        fontSize: 13,
      });

      // @ts-ignore - monaco is loaded via AMD
      const original = monaco.editor.createModel(
        originalCode || "// New file",
        language,
      );
      // @ts-ignore - monaco is loaded via AMD
      const modified = monaco.editor.createModel(newCode, language);

      this.monacoDiffEditor.setModel({
        original: original,
        modified: modified,
      });

      resolve();
    });
  }

  closeDiffModal() {
    const modal = document.getElementById("diff-modal");
    if (!modal) return;

    modal.style.display = "none";

    if (this.monacoDiffEditor) {
      this.monacoDiffEditor.dispose();
      this.monacoDiffEditor = null;
    }

    this.pendingChange = null;
  }

  async applyPendingChange() {
    console.log("[Editor] applyPendingChange() called");
    console.log("[Editor] pendingChange:", this.pendingChange);
    console.log("[Editor] pendingToolExecution:", this.pendingToolExecution);
    console.log("[Editor] currentAISession:", this.currentAISession);

    if (!this.pendingChange) return;

    const { name, newCode, action, contentType } = this.pendingChange;

    try {
      if (contentType === "asset") {
        // Handle asset creation/editing
        if (action === "create" || action === "edit") {
          // Convert content to base64 using UTF-8 safe encoding
          const base64 = this.textToBase64(newCode);

          // Determine MIME type from extension
          const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
          /** @type {Record<string, string>} */
          const mimeTypes = {
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".html": "text/html",
            ".md": "text/markdown",
            ".txt": "text/plain",
            ".js": "application/javascript",
            ".xml": "application/xml",
            ".yaml": "text/yaml",
            ".yml": "text/yaml",
          };
          const mimetype = mimeTypes[ext] || "text/plain";

          // Get the script URI from tool input or fallback to current script
          let scriptUri = "https://example.com/editor"; // default fallback

          if (
            this.pendingToolExecution &&
            this.pendingToolExecution.toolInput
          ) {
            const scriptName = this.pendingToolExecution.toolInput.script_name;
            if (scriptName) {
              // Convert script name to URI (e.g., "hello-world.js" -> "https://example.com/hello-world.js")
              scriptUri = `https://example.com/${scriptName.replace(/\.js$/, ".js")}`;
            }
          }

          const scriptUriEncoded = encodeURIComponent(scriptUri);

          const response = await fetch(`/assets?script=${scriptUriEncoded}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              asset: name,
              mimetype: mimetype,
              content: base64,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to save asset: ${response.status}`);
          }

          this.showStatus(
            `Asset ${action === "create" ? "created" : "updated"} successfully`,
            "success",
          );
          this.loadAssets();

          // Switch to Assets tab and set the content directly
          this.switchTab("assets");

          // Set the asset directly from newCode instead of loading from server
          // This avoids any server-side encoding issues
          this.currentAsset = name;

          // Update active state in list
          document.querySelectorAll(".asset-item").forEach((item) => {
            item.classList.remove("active");
          });

          // Update toolbar
          this.setText("current-asset-name", name);
          this.setDisabled("save-asset-btn", false);
          this.setDisabled("delete-asset-btn", false);

          // Set content directly from newCode
          this.monacoAssetEditor.setValue(newCode);
          const language = this.getLanguageMode(name);
          // @ts-ignore - monaco is loaded via AMD
          monaco.editor.setModelLanguage(
            this.monacoAssetEditor.getModel(),
            language,
          );

          // Show editor
          this.setDisplay("monaco-asset-editor", "block");
          this.setDisplay("binary-asset-info", "none");
          this.setDisplay("no-asset-selected", "none");

          // Wait a bit for the list to reload, then update the active item
          setTimeout(() => {
            const activeItem = document.querySelector(`[data-path="${name}"]`);
            if (activeItem) {
              activeItem.classList.add("active");
            }
          }, 100);
        }
      } else {
        // Handle script creation/editing (existing logic)
        if (action === "create" || action === "edit") {
          const encodedScriptName = encodeURIComponent(name);
          const response = await fetch(`/api/scripts/${encodedScriptName}`, {
            method: "POST",
            body: newCode,
          });

          if (!response.ok) {
            throw new Error(`Failed to save script: ${response.status}`);
          }

          this.showStatus(
            `Script ${action === "create" ? "created" : "updated"} successfully`,
            "success",
          );
          this.loadScripts();

          // Load the script in editor
          this.loadScript(name);
        }
      }

      console.log(
        "[Editor] Closing diff modal and checking if we need to continue AI conversation...",
      );
      console.log(
        "[Editor] pendingToolExecution exists:",
        !!this.pendingToolExecution,
      );
      console.log("[Editor] currentAISession exists:", !!this.currentAISession);

      this.closeDiffModal();

      // If this was triggered by an AI tool execution, send the result back
      if (this.pendingToolExecution && this.currentAISession) {
        const { toolUseId } = this.pendingToolExecution;
        console.log(
          "[Editor] Sending tool result back to AI, toolUseId:",
          toolUseId,
        );

        // Add tool result to session
        const toolResultContent = `Successfully ${action === "create" ? "created" : "updated"} ${contentType === "asset" ? "asset" : "script"}: ${name}`;
        console.log("[Editor] Tool result content:", toolResultContent);

        this.currentAISession.messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseId,
              content: toolResultContent,
            },
          ],
        });

        this.pendingToolExecution = null;

        // Continue the AI conversation
        console.log("[Editor] Calling continueAIConversation()...");
        await this.continueAIConversation();
        console.log("[Editor] continueAIConversation() completed");
      }
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.showStatus(`Error applying changes: ${err.message}`, "error");

      // If this was triggered by an AI tool execution, send error result back
      if (this.pendingToolExecution && this.currentAISession) {
        const { toolUseId } = this.pendingToolExecution;

        this.currentAISession.messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseId,
              content: `Error: ${err.message}`,
            },
          ],
        });

        this.pendingToolExecution = null;

        // Continue the AI conversation even after error
        await this.continueAIConversation();
      }
    }
  }

  /**
   * @param {string} assetPath
   * @param {string} explanation
   */
  confirmDeleteAsset(assetPath, explanation) {
    if (
      confirm(`${explanation}\n\nAre you sure you want to delete ${assetPath}?`)
    ) {
      fetch(`/api/assets/${assetPath}`, {
        method: "DELETE",
      })
        .then(() => {
          this.showStatus("Asset deleted successfully", "success");
          this.loadAssets();

          if (this.currentAsset === assetPath) {
            this.currentAsset = null;
            this.setText("current-asset-name", "No asset selected");
            this.setDisplay("monaco-asset-editor", "none");
            this.setDisplay("binary-asset-info", "none");
            this.setDisplay("no-asset-selected", "block");
          }
        })
        .catch((error) => {
          const err = /** @type {Error} */ (error);
          this.showStatus("Error deleting asset: " + err.message, "error");
        });
    }
  }

  /**
   * @param {string} scriptName
   * @param {string} explanation
   */
  confirmDeleteScript(scriptName, explanation) {
    if (
      confirm(
        `${explanation}\n\nAre you sure you want to delete ${scriptName}?`,
      )
    ) {
      const encodedScriptName = encodeURIComponent(scriptName);
      fetch(`/api/scripts/${encodedScriptName}`, {
        method: "DELETE",
      })
        .then(() => {
          this.showStatus("Script deleted successfully", "success");
          this.loadScripts();

          if (this.currentScript === scriptName) {
            this.currentScript = null;
            this.setText("current-script-name", "No script selected");
            if (this.monacoEditor) {
              this.monacoEditor.setValue("// Select a script to edit");
            }
          }
        })
        .catch((error) => {
          const err = /** @type {Error} */ (error);
          this.showStatus("Error deleting script: " + err.message, "error");
        });
    }
  }

  clearAIPrompt() {
    const promptInput = /** @type {HTMLInputElement | null} */ (
      document.getElementById("ai-prompt")
    );
    if (promptInput) {
      promptInput.value = "";
      promptInput.focus();
    }
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the editor when the page loads
function initEditor() {
  console.log("[Editor] initEditor() called, DOM ready");
  console.log("[Editor] Creating AIWebEngineEditor instance...");
  // @ts-ignore - window.editor is expected by onclick handlers in HTML
  window.editor = new AIWebEngineEditor();
}

console.log("[Editor] Script loaded, waiting for DOMContentLoaded...");
document.addEventListener("DOMContentLoaded", initEditor);
