(function (global) {
    "use strict";

    class ViewManager {
        constructor(options = {}) {
            if (
                !options.container ||
                typeof options.container.innerHTML !== "string"
            ) {
                throw new Error(
                    "A valid DOM container is required."
                );
            }

            this.container = options.container;
            this.controllers = new Map();
            this.currentControllerId = null;
            this.events = new Map();
        }

        register(controller) {
            if (
                !controller ||
                typeof controller.id !== "string" ||
                !controller.id.trim()
            ) {
                throw new Error(
                    "A valid module controller is required."
                );
            }

            if (
                typeof controller.mount !== "function" ||
                typeof controller.unmount !== "function"
            ) {
                throw new Error(
                    `Controller '${controller.id}' is invalid.`
                );
            }

            const id = controller.id.trim();

            this.controllers.set(
                id,
                controller
            );

            this.emit("registered", {
                id
            });

            return controller;
        }

        registerMany(controllers = []) {
            if (!Array.isArray(controllers)) {
                throw new Error(
                    "Controllers must be an array."
                );
            }

            controllers.forEach(
                (controller) => {
                    this.register(controller);
                }
            );

            return this.getRegisteredIds();
        }

        getController(id) {
            return this.controllers.get(id) || null;
        }

        getCurrentController() {
            return this.currentControllerId
                ? this.getController(
                    this.currentControllerId
                )
                : null;
        }

        getRegisteredIds() {
            return Array.from(
                this.controllers.keys()
            );
        }

        has(id) {
            return this.controllers.has(id);
        }

        async show(id, context = {}) {
            const nextController =
                this.getController(id);

            if (!nextController) {
                throw new Error(
                    `Controller '${id}' is not registered.`
                );
            }

            const currentController =
                this.getCurrentController();

            if (
                currentController &&
                currentController.id === id
            ) {
                await currentController.unmount();

                await currentController.mount(
                    this.container,
                    context
                );

                this.currentControllerId =
                    id;

                this.emit("shown", {
                    id,
                    reused: true,
                    refreshed: true
                });

                return this.getState();
            }

            if (currentController) {
                await currentController.unmount();

                this.emit("hidden", {
                    id: currentController.id
                });
            }

            await nextController.mount(
                this.container,
                context
            );

            this.currentControllerId = id;

            this.emit("shown", {
                id,
                reused: false
            });

            return this.getState();
        }

        async hideCurrent() {
            const currentController =
                this.getCurrentController();

            if (!currentController) {
                return this.getState();
            }

            if (
                typeof currentController.hide ===
                "function"
            ) {
                await currentController.hide();
            }

            this.emit("hidden", {
                id: currentController.id
            });

            return this.getState();
        }

        async unmountCurrent() {
            const currentController =
                this.getCurrentController();

            if (!currentController) {
                return this.getState();
            }

            await currentController.unmount();

            this.emit("unmounted", {
                id: currentController.id
            });

            this.currentControllerId = null;

            return this.getState();
        }

        async validateCurrent() {
            const currentController =
                this.getCurrentController();

            if (!currentController) {
                return true;
            }

            if (
                typeof currentController.validate !==
                "function"
            ) {
                return true;
            }

            return await currentController.validate();
        }

        async saveCurrent() {
            const currentController =
                this.getCurrentController();

            if (!currentController) {
                return null;
            }

            if (
                typeof currentController.save !==
                "function"
            ) {
                return null;
            }

            return await currentController.save();
        }

        async destroy(id) {
            const controller =
                this.getController(id);

            if (!controller) {
                return false;
            }

            if (
                this.currentControllerId === id
            ) {
                await this.unmountCurrent();
            }

            if (
                typeof controller.destroy ===
                "function"
            ) {
                await controller.destroy();
            }

            this.controllers.delete(id);

            this.emit("destroyed", {
                id
            });

            return true;
        }

        async destroyAll() {
            const ids =
                this.getRegisteredIds();

            for (const id of ids) {
                await this.destroy(id);
            }

            return this.getState();
        }

        getState() {
            const current =
                this.getCurrentController();

            return {
                current_controller_id:
                    this.currentControllerId,
                registered_count:
                    this.controllers.size,
                registered_ids:
                    this.getRegisteredIds(),
                has_current:
                    Boolean(current),
                current_state:
                    current &&
                    typeof current.getState === "function"
                        ? current.getState()
                        : null
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

        _clone(value) {
            if (value === undefined) {
                return undefined;
            }

            return JSON.parse(
                JSON.stringify(value)
            );
        }
    }

    global.ViewManager = ViewManager;

})(window);