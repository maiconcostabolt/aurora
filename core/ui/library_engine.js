(function (global) {
    "use strict";

    class LibraryEngine {
        constructor() {
            this.libraries = new Map();
        }

        register(library) {
            this._validateLibrary(library);

            const copy = this._clone(library);

            this.libraries.set(
                copy.id,
                copy
            );

            return this.get(copy.id);
        }

        registerMany(libraries = []) {
            if (!Array.isArray(libraries)) {
                throw new Error(
                    "Libraries must be an array."
                );
            }

            libraries.forEach((library) => {
                this.register(library);
            });

            return this.getIds();
        }

        get(libraryId) {
            const library =
                this.libraries.get(libraryId);

            return library
                ? this._clone(library)
                : null;
        }

        getItems(libraryId) {
            const library =
                this.get(libraryId);

            return library
                ? this._clone(library.items)
                : [];
        }

        search(libraryId, query = "") {
            const normalizedQuery =
                String(query)
                    .trim()
                    .toLowerCase();

            const items =
                this.getItems(libraryId);

            if (!normalizedQuery) {
                return items;
            }

            return items.filter((item) => {
                const normalized =
                    typeof item === "object"
                        ? item
                        : {
                            value: item,
                            label: item
                        };

                return [
                    normalized.value,
                    normalized.label,
                    normalized.description
                ]
                    .filter(Boolean)
                    .some((value) => {
                        return String(value)
                            .toLowerCase()
                            .includes(
                                normalizedQuery
                            );
                    });
            });
        }

        getIds() {
            return Array.from(
                this.libraries.keys()
            );
        }

        has(libraryId) {
            return this.libraries.has(
                libraryId
            );
        }

        remove(libraryId) {
            return this.libraries.delete(
                libraryId
            );
        }

        clear() {
            this.libraries.clear();
        }

        _validateLibrary(library) {
            if (
                !library ||
                typeof library !== "object"
            ) {
                throw new Error(
                    "Invalid library."
                );
            }

            if (
                typeof library.id !== "string" ||
                !library.id.trim()
            ) {
                throw new Error(
                    "Library requires a valid id."
                );
            }

            if (!Array.isArray(library.items)) {
                throw new Error(
                    `Library '${library.id}' requires an items array.`
                );
            }
        }

        _clone(value) {
            return JSON.parse(
                JSON.stringify(value)
            );
        }
    }

    global.LibraryEngine =
        LibraryEngine;

})(window);