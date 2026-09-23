(function (global) {
"use strict";

class EvidenceStore {
    constructor(options = {}) {
        this.databaseName =
            options.databaseName ||
            "aurora_evidence_db";

        this.storeName =
            options.storeName ||
            "evidences";

        this.version =
            options.version ||
            1;

        this.dbPromise =
            null;
    }

    open() {
        if (this.dbPromise) {
            return this.dbPromise;
        }

        this.dbPromise =
            new Promise(
                (resolve, reject) => {
                    const request =
                        indexedDB.open(
                            this.databaseName,
                            this.version
                        );

                    request.onupgradeneeded =
                        () => {
                            const db =
                                request.result;

                            if (
                                !db.objectStoreNames.contains(
                                    this.storeName
                                )
                            ) {
                                const store =
                                    db.createObjectStore(
                                        this.storeName,
                                        {
                                            keyPath: "id"
                                        }
                                    );

                                store.createIndex(
                                    "case_id",
                                    "case_id",
                                    {
                                        unique: false
                                    }
                                );

                                store.createIndex(
                                    "occurrence_id",
                                    "occurrence_id",
                                    {
                                        unique: false
                                    }
                                );

                                store.createIndex(
                                    "created_at",
                                    "created_at",
                                    {
                                        unique: false
                                    }
                                );
                            }
                        };

                    request.onsuccess =
                        () => {
                            resolve(
                                request.result
                            );
                        };

                    request.onerror =
                        () => {
                            reject(
                                request.error
                            );
                        };
                }
            );

        return this.dbPromise;
    }

    async save(evidence) {
        if (
            !evidence ||
            !evidence.id
        ) {
            throw new Error(
                "Evidence must have an id."
            );
        }

        const db =
            await this.open();

        return new Promise(
            (resolve, reject) => {
                const transaction =
                    db.transaction(
                        this.storeName,
                        "readwrite"
                    );

                const store =
                    transaction.objectStore(
                        this.storeName
                    );

                store.put(
                    this._clone(evidence)
                );

                transaction.oncomplete =
                    () => {
                        resolve(
                            this._clone(evidence)
                        );
                    };

                transaction.onerror =
                    () => {
                        reject(
                            transaction.error
                        );
                    };
            }
        );
    }

    async get(id) {
        const db =
            await this.open();

        return new Promise(
            (resolve, reject) => {
                const request =
                    db.transaction(
                        this.storeName,
                        "readonly"
                    )
                        .objectStore(
                            this.storeName
                        )
                        .get(id);

                request.onsuccess =
                    () => {
                        resolve(
                            request.result
                                ? this._clone(
                                    request.result
                                )
                                : null
                        );
                    };

                request.onerror =
                    () => {
                        reject(
                            request.error
                        );
                    };
            }
        );
    }

    async listByCase(caseId) {
        const db =
            await this.open();

        return new Promise(
            (resolve, reject) => {
                const transaction =
                    db.transaction(
                        this.storeName,
                        "readonly"
                    );

                const index =
                    transaction
                        .objectStore(
                            this.storeName
                        )
                        .index(
                            "case_id"
                        );

                const request =
                    index.getAll(
                        caseId
                    );

                request.onsuccess =
                    () => {
                        const items =
                            Array.isArray(
                                request.result
                            )
                                ? request.result
                                : [];

                        items.sort(
                            (a, b) =>
                                String(
                                    a.created_at
                                ).localeCompare(
                                    String(
                                        b.created_at
                                    )
                                )
                        );

                        resolve(
                            this._clone(items)
                        );
                    };

                request.onerror =
                    () => {
                        reject(
                            request.error
                        );
                    };
            }
        );
    }

    async remove(id) {
        const db =
            await this.open();

        return new Promise(
            (resolve, reject) => {
                const transaction =
                    db.transaction(
                        this.storeName,
                        "readwrite"
                    );

                transaction
                    .objectStore(
                        this.storeName
                    )
                    .delete(id);

                transaction.oncomplete =
                    () => {
                        resolve(true);
                    };

                transaction.onerror =
                    () => {
                        reject(
                            transaction.error
                        );
                    };
            }
        );
    }

    async clearCase(caseId) {
        const items =
            await this.listByCase(
                caseId
            );

        for (
            const item of items
        ) {
            await this.remove(
                item.id
            );
        }

        return items.length;
    }

    _clone(value) {
        return JSON.parse(
            JSON.stringify(value)
        );
    }
}

global.EvidenceStore =
    EvidenceStore;

})(window);
