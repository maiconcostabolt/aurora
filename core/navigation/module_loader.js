(function (global) {
    "use strict";

    class ModuleLoader {
        constructor(options = {}) {
            this.basePath =
                typeof options.basePath === "string" &&
                options.basePath.trim()
                    ? options.basePath.trim().replace(/\/+$/, "")
                    : "../modules";

            this.registry = new Map();
            this.loaded = new Map();
            this.history = [];
            this.currentModuleId = null;
        }

        register(moduleId, definition) {
            this._validateModuleId(moduleId);

            if (!definition || typeof definition !== "object") {
                throw new Error(
                    `Invalid module definition for '${moduleId}'.`
                );
            }

            const normalizedId = moduleId.trim();

            this.registry.set(
                normalizedId,
                {
                    id: normalizedId,
                    html:
                        definition.html ||
                        `${normalizedId}/${normalizedId}.html`,
                    css:
                        definition.css ||
                        `${normalizedId}/${normalizedId}.css`,
                    script:
                        definition.script ||
                        `${normalizedId}/${normalizedId}_view.js`,
                    metadata:
                        definition.metadata
                            ? this._clone(definition.metadata)
                            : {}
                }
            );

            return this.getDefinition(normalizedId);
        }

        registerMany(definitions = {}) {
            Object.entries(definitions).forEach(
                ([moduleId, definition]) => {
                    this.register(
                        moduleId,
                        definition
                    );
                }
            );

            return this.getRegisteredModules();
        }

        async load(moduleId) {
            this._validateModuleId(moduleId);

            const normalizedId = moduleId.trim();

            if (this.loaded.has(normalizedId)) {
                this.currentModuleId = normalizedId;

                this._recordHistory(
                    normalizedId,
                    "cache"
                );

                return this.get(normalizedId);
            }

            const definition =
                this.registry.get(normalizedId) ||
                this.register(
                    normalizedId,
                    {}
                );

            const moduleData = {
                id: normalizedId,
                definition:
                    this._clone(definition),
                html:
                    await this._loadText(
                        this._resolvePath(
                            definition.html
                        ),
                        false
                    ),
                css:
                    await this._loadText(
                        this._resolvePath(
                            definition.css
                        ),
                        true
                    ),
                script_url:
                    this._resolvePath(
                        definition.script
                    ),
                loaded_at:
                    new Date().toISOString()
            };

            this.loaded.set(
                normalizedId,
                moduleData
            );

            this.currentModuleId =
                normalizedId;

            this._recordHistory(
                normalizedId,
                "network"
            );

            return this.get(normalizedId);
        }

        get(moduleId) {
            if (!moduleId) {
                return null;
            }

            const moduleData =
                this.loaded.get(moduleId);

            return moduleData
                ? this._clone(moduleData)
                : null;
        }

        getCurrent() {
            return this.currentModuleId
                ? this.get(this.currentModuleId)
                : null;
        }

        getDefinition(moduleId) {
            if (!moduleId) {
                return null;
            }

            const definition =
                this.registry.get(moduleId);

            return definition
                ? this._clone(definition)
                : null;
        }

        getRegisteredModules() {
            return Array.from(
                this.registry.keys()
            );
        }

        getLoadedModules() {
            return Array.from(
                this.loaded.keys()
            );
        }

        getHistory() {
            return this._clone(
                this.history
            );
        }

        isLoaded(moduleId) {
            return this.loaded.has(moduleId);
        }

        unload(moduleId) {
            const removed =
                this.loaded.delete(moduleId);

            if (
                removed &&
                this.currentModuleId === moduleId
            ) {
                this.currentModuleId = null;
            }

            return removed;
        }

        clear() {
            this.loaded.clear();
            this.history = [];
            this.currentModuleId = null;
        }

        _resolvePath(relativePath) {
            if (
                /^https?:\/\//i.test(relativePath) ||
                relativePath.startsWith("/")
            ) {
                return relativePath;
            }

            return `${this.basePath}/${relativePath}`;
        }

        async _loadText(url, optional) {
            const response =
                await fetch(url);

            if (!response.ok) {
                if (optional) {
                    return "";
                }

                throw new Error(
                    `Module resource not found: ${url}`
                );
            }

            return await response.text();
        }

        _recordHistory(moduleId, source) {
            this.history.push({
                module_id: moduleId,
                source,
                timestamp:
                    new Date().toISOString()
            });
        }

        _validateModuleId(moduleId) {
            if (
                typeof moduleId !== "string" ||
                !moduleId.trim()
            ) {
                throw new Error(
                    "A valid module id is required."
                );
            }
        }

        _clone(value) {
            if (value === undefined) {
                return undefined;
            }

            return JSON.parse(
                JSON.stringify(value)
            );
        }
    }

    global.ModuleLoader = ModuleLoader;

})(window);