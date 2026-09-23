(function (global) {
    "use strict";

    class ModuleController {
        constructor(options = {}) {
            if (
                typeof options.id !== "string" ||
                !options.id.trim()
            ) {
                throw new Error(
                    "A valid module id is required."
                );
            }

            this.id = options.id.trim();
            this.loaded = false;
            this.mounted = false;
            this.visible = false;
            this.destroyed = false;
            this.context = null;
            this.container = null;
            this.events = new Map();
        }

        async load(context = {}) {
            this._requireActive();

            this.context =
                this._clone(context);

            await this.onLoad(
                this._clone(this.context)
            );

            this.loaded = true;

            this.emit("loaded", {
                id: this.id,
                context:
                    this._clone(this.context)
            });

            return this.getState();
        }

        async mount(container, context = null) {
            this._requireActive();

            if (
                !container ||
                typeof container.innerHTML !== "string"
            ) {
                throw new Error(
                    "A valid DOM container is required."
                );
            }

            /*
             * RC2.2
             *
             * Todo mount precisa recarregar o contexto do atendimento.
             * Antes, onLoad() era chamado somente na primeira abertura.
             * Ao voltar para uma etapa, o formulário era reconstruído
             * com initialValues antigos.
             */
            await this.load(
                context || {}
            );

            this.container = container;

            const html =
                await this.render(
                    this._clone(
                        this.context || {}
                    )
                );

            this.container.innerHTML =
                typeof html === "string"
                    ? html
                    : "";

            await this.bindEvents(
                this.container,
                this._clone(
                    this.context || {}
                )
            );

            this.mounted = true;
            this.visible = true;

            await this.onShow(
                this._clone(
                    this.context || {}
                )
            );

            this.emit("mounted", {
                id: this.id
            });

            return this.getState();
        }

        async show() {
            this._requireMounted();

            this.container.hidden = false;
            this.visible = true;

            await this.onShow(
                this._clone(
                    this.context || {}
                )
            );

            this.emit("shown", {
                id: this.id
            });

            return this.getState();
        }

        async hide() {
            this._requireMounted();

            await this.onHide(
                this._clone(
                    this.context || {}
                )
            );

            this.container.hidden = true;
            this.visible = false;

            this.emit("hidden", {
                id: this.id
            });

            return this.getState();
        }

        async validate() {
            this._requireActive();

            const result =
                await this.onValidate(
                    this._clone(
                        this.context || {}
                    )
                );

            return result !== false;
        }

        async save() {
            this._requireActive();

            const result =
                await this.onSave(
                    this._clone(
                        this.context || {}
                    )
                );

            return result === undefined
                ? null
                : this._clone(result);
        }

        async unmount() {
            this._requireActive();

            if (!this.mounted) {
                return this.getState();
            }

            await this.onHide(
                this._clone(
                    this.context || {}
                )
            );

            await this.onUnmount(
                this._clone(
                    this.context || {}
                )
            );

            if (this.container) {
                this.container.innerHTML = "";
                this.container.hidden = false;
            }

            this.container = null;
            this.mounted = false;
            this.visible = false;

            this.emit("unmounted", {
                id: this.id
            });

            return this.getState();
        }

        async destroy() {
            if (this.destroyed) {
                return this.getState();
            }

            if (this.mounted) {
                await this.unmount();
            }

            await this.onDestroy(
                this._clone(
                    this.context || {}
                )
            );

            this.events.clear();
            this.context = null;
            this.container = null;
            this.loaded = false;
            this.visible = false;
            this.destroyed = true;

            return this.getState();
        }

        getState() {
            return {
                id: this.id,
                loaded: this.loaded,
                mounted: this.mounted,
                visible: this.visible,
                destroyed: this.destroyed,
                has_context:
                    Boolean(this.context),
                has_container:
                    Boolean(this.container)
            };
        }

        on(eventName, listener) {
            if (
                typeof listener !== "function"
            ) {
                throw new Error(
                    "Listener must be a function."
                );
            }

            if (!this.events.has(eventName)) {
                this.events.set(
                    eventName,
                    new Set()
                );
            }

            this.events
                .get(eventName)
                .add(listener);

            return () =>
                this.off(
                    eventName,
                    listener
                );
        }

        off(eventName, listener) {
            const listeners =
                this.events.get(eventName);

            if (!listeners) {
                return;
            }

            listeners.delete(listener);

            if (!listeners.size) {
                this.events.delete(eventName);
            }
        }

        emit(eventName, payload) {
            const listeners =
                this.events.get(eventName);

            if (!listeners) {
                return;
            }

            listeners.forEach(
                (listener) => {
                    listener(
                        this._clone(payload)
                    );
                }
            );
        }

        async onLoad() {}

        async render() {
            return "";
        }

        async bindEvents() {}

        async onShow() {}

        async onHide() {}

        async onValidate() {
            return true;
        }

        async onSave() {
            return null;
        }

        async onUnmount() {}

        async onDestroy() {}

        _requireMounted() {
            this._requireActive();

            if (!this.mounted) {
                throw new Error(
                    `Module '${this.id}' is not mounted.`
                );
            }
        }

        _requireActive() {
            if (this.destroyed) {
                throw new Error(
                    `Module '${this.id}' was destroyed.`
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

    global.ModuleController =
        ModuleController;

})(window);