(function (global) {
"use strict";

class PhotoEditor {
    constructor(options = {}) {
        this.onSave =
            typeof options.onSave === "function"
                ? options.onSave
                : null;

        this.modal = null;
        this.canvas = null;
        this.context = null;
        this.image = null;
        this.sourceEvidence = null;

        this.tool = "select";
        this.objects = [];
        this.selectedId = null;
        this.dragging = false;
        this.dragOffset = null;
        this.startPoint = null;

        this.color = "#64f0e5";
        this.lineWidth = 6;
        this.autoSaveTimer = null;
    }

    mount() {
        if (this.modal) return;

        this.modal =
            document.createElement("div");

        this.modal.className =
            "aurora-photo-editor";

        this.modal.innerHTML = [
            '<button type="button" class="aurora-photo-editor__backdrop" data-editor-close aria-label="Fechar editor"></button>',
            '<section class="aurora-photo-editor__sheet">',
            '<header>',
            '<div>',
            '<strong>Editar evidência</strong>',
            '<span>O objeto permanece selecionado até escolher outra ferramenta ou clicar fora dele.</span>',
            '</div>',
            '<button type="button" data-editor-close>×</button>',
            '</header>',

            '<nav class="aurora-photo-editor__tools">',
            '<button type="button" class="is-active" data-editor-tool="select">⌖ Seleção</button>',
            '<button type="button" data-editor-tool="line">╱ Linha</button>',
            '<button type="button" data-editor-tool="circle">○ Círculo</button>',
            '<button type="button" data-editor-tool="arrow">→ Seta</button>',
            '<button type="button" data-editor-tool="text">T Texto</button>',
            '</nav>',

            '<div class="aurora-photo-editor__adjustments">',
            '<button type="button" data-editor-scale-down title="Diminuir">−</button>',
            '<button type="button" data-editor-scale-up title="Aumentar">＋</button>',
            '<button type="button" data-editor-rotate-left title="Girar para esquerda">↶</button>',
            '<button type="button" data-editor-rotate-right title="Girar para direita">↷</button>',
            '<label title="Cor"><span>Cor</span><input type="color" value="#64f0e5" data-editor-color></label>',
            '<label title="Espessura"><span>Espessura</span><input type="range" min="2" max="24" value="6" data-editor-width></label>',
            '<button type="button" data-editor-delete title="Excluir objeto">Excluir objeto</button>',
            '<button type="button" data-editor-undo title="Desfazer">↶ Desfazer</button>',
            '</div>',

            '<div class="aurora-photo-editor__stage">',
            '<canvas data-editor-canvas></canvas>',
            '</div>',

            '<footer>',
            '<span data-editor-status>Alterações salvas automaticamente</span>',
            '<div>',
            '<button type="button" data-editor-close>Cancelar</button>',
            '<button type="button" class="is-primary" data-editor-save>Salvar foto</button>',
            '</div>',
            '</footer>',
            '</section>'
        ].join("");

        document.body.appendChild(
            this.modal
        );

        this.canvas =
            this.modal.querySelector(
                "[data-editor-canvas]"
            );

        this.context =
            this.canvas.getContext("2d");

        this.modal
            .querySelectorAll(
                "[data-editor-close]"
            )
            .forEach(
                (button) => {
                    button.addEventListener(
                        "click",
                        () => this.close()
                    );
                }
            );

        this.modal
            .querySelectorAll(
                "[data-editor-tool]"
            )
            .forEach(
                (button) => {
                    button.addEventListener(
                        "click",
                        () => {
                            this.setTool(
                                button.dataset.editorTool
                            );
                        }
                    );
                }
            );

        this.modal
            .querySelector(
                "[data-editor-color]"
            )
            .addEventListener(
                "input",
                (event) => {
                    this.color =
                        event.target.value;

                    const object =
                        this.getSelected();

                    if (object) {
                        object.color =
                            this.color;
                        this.redraw();
                        this.scheduleAutoSave();
                    }
                }
            );

        this.modal
            .querySelector(
                "[data-editor-width]"
            )
            .addEventListener(
                "input",
                (event) => {
                    this.lineWidth =
                        Number(
                            event.target.value
                        );

                    const object =
                        this.getSelected();

                    if (object) {
                        object.lineWidth =
                            this.lineWidth;
                        this.redraw();
                        this.scheduleAutoSave();
                    }
                }
            );

        this.modal
            .querySelector(
                "[data-editor-scale-up]"
            )
            .addEventListener(
                "click",
                () => this.scaleSelected(1.12)
            );

        this.modal
            .querySelector(
                "[data-editor-scale-down]"
            )
            .addEventListener(
                "click",
                () => this.scaleSelected(.88)
            );

        this.modal
            .querySelector(
                "[data-editor-rotate-left]"
            )
            .addEventListener(
                "click",
                () => this.rotateSelected(-15)
            );

        this.modal
            .querySelector(
                "[data-editor-rotate-right]"
            )
            .addEventListener(
                "click",
                () => this.rotateSelected(15)
            );

        this.modal
            .querySelector(
                "[data-editor-delete]"
            )
            .addEventListener(
                "click",
                () => this.deleteSelected()
            );

        this.modal
            .querySelector(
                "[data-editor-undo]"
            )
            .addEventListener(
                "click",
                () => this.undo()
            );

        this.modal
            .querySelector(
                "[data-editor-save]"
            )
            .addEventListener(
                "click",
                () => this.save(false)
            );

        this.canvas.addEventListener(
            "pointerdown",
            (event) =>
                this.handlePointerDown(event)
        );

        this.canvas.addEventListener(
            "pointermove",
            (event) =>
                this.handlePointerMove(event)
        );

        this.canvas.addEventListener(
            "pointerup",
            (event) =>
                this.handlePointerUp(event)
        );

        this.canvas.addEventListener(
            "pointercancel",
            () => {
                this.dragging = false;
            }
        );
    }

    async open(evidence) {
        this.mount();

        this.sourceEvidence =
            evidence;

        this.image =
            await this.loadImage(
                evidence.original_src ||
                evidence.src ||
                evidence.edited_src
            );

        const maxWidth =
            Math.min(
                this.image.naturalWidth,
                1600
            );

        const ratio =
            maxWidth /
            this.image.naturalWidth;

        this.canvas.width =
            Math.round(
                this.image.naturalWidth *
                ratio
            );

        this.canvas.height =
            Math.round(
                this.image.naturalHeight *
                ratio
            );

        this.objects =
            Array.isArray(
                evidence.editor_objects
            )
                ? JSON.parse(
                    JSON.stringify(
                        evidence.editor_objects
                    )
                )
                : [];

        this.selectedId = null;
        this.setTool("select");
        this.redraw();

        this.modal.classList.add(
            "is-open"
        );

        document.body.classList.add(
            "aurora-photo-editor-open"
        );
    }

    close() {
        if (!this.modal) return;

        clearTimeout(
            this.autoSaveTimer
        );

        this.modal.classList.remove(
            "is-open"
        );

        document.body.classList.remove(
            "aurora-photo-editor-open"
        );
    }

    setTool(tool) {
        this.tool =
            tool || "select";

        /*
         * Ao escolher uma nova ferramenta,
         * a seleção atual é encerrada.
         */
        if (
            this.tool !==
            "select"
        ) {
            this.selectedId = null;
            this.redraw();
        }

        this.modal
            .querySelectorAll(
                "[data-editor-tool]"
            )
            .forEach(
                (button) => {
                    button.classList.toggle(
                        "is-active",
                        button.dataset.editorTool ===
                        this.tool
                    );
                }
            );

        this.canvas.style.cursor =
            this.tool === "select"
                ? "default"
                : "crosshair";
    }

    async handlePointerDown(event) {
        const point =
            this.point(event);

        if (
            this.tool ===
            "select"
        ) {
            const selected =
                this.findObjectAt(
                    point
                );

            if (!selected) {
                this.selectedId = null;
                this.dragging = false;
                this.redraw();
                return;
            }

            this.selectedId =
                selected.id;

            this.dragging = true;

            this.dragOffset = {
                x:
                    point.x -
                    selected.x,
                y:
                    point.y -
                    selected.y
            };

            this.syncControls(
                selected
            );

            this.redraw();
            return;
        }

        if (
            this.tool ===
            "text"
        ) {
            const text =
                await window.AuroraDialog.prompt("Digite o texto que será inserido na imagem.", "", { title: "Texto da marcação", confirmLabel: "Adicionar", fieldLabel: "Marcação" });

            if (text) {
                const object = {
                    id:
                        this.uid(),
                    type:
                        "text",
                    x:
                        point.x,
                    y:
                        point.y,
                    text,
                    color:
                        this.color,
                    lineWidth:
                        this.lineWidth,
                    scale:
                        1,
                    rotation:
                        0
                };

                this.objects.push(
                    object
                );

                this.selectedId =
                    object.id;

                this.redraw();
                this.scheduleAutoSave();
            }

            /*
             * Após criar, volta à seleção
             * e mantém o novo objeto selecionado.
             */
            this.setToolKeepingSelection(
                "select"
            );

            return;
        }

        this.startPoint =
            point;
    }

    handlePointerMove(event) {
        if (
            this.tool !==
            "select" ||
            !this.dragging
        ) {
            return;
        }

        const object =
            this.getSelected();

        if (!object) return;

        const point =
            this.point(event);

        object.x =
            point.x -
            this.dragOffset.x;

        object.y =
            point.y -
            this.dragOffset.y;

        this.redraw();
    }

    handlePointerUp(event) {
        const point =
            this.point(event);

        if (
            this.tool ===
            "select"
        ) {
            if (this.dragging) {
                this.dragging = false;
                this.scheduleAutoSave();
            }

            return;
        }

        if (!this.startPoint) {
            return;
        }

        const object =
            this.createShapeObject(
                this.tool,
                this.startPoint,
                point
            );

        if (object) {
            this.objects.push(
                object
            );

            this.selectedId =
                object.id;

            this.redraw();
            this.scheduleAutoSave();
        }

        this.startPoint = null;

        this.setToolKeepingSelection(
            "select"
        );
    }

    setToolKeepingSelection(tool) {
        this.tool =
            tool;

        this.modal
            .querySelectorAll(
                "[data-editor-tool]"
            )
            .forEach(
                (button) => {
                    button.classList.toggle(
                        "is-active",
                        button.dataset.editorTool ===
                        tool
                    );
                }
            );

        this.canvas.style.cursor =
            "default";

        this.redraw();
    }

    createShapeObject(
        type,
        start,
        end
    ) {
        const width =
            end.x - start.x;

        const height =
            end.y - start.y;

        if (
            Math.abs(width) < 4 &&
            Math.abs(height) < 4
        ) {
            return null;
        }

        return {
            id:
                this.uid(),
            type,
            x:
                start.x,
            y:
                start.y,
            width,
            height,
            color:
                this.color,
            lineWidth:
                this.lineWidth,
            scale:
                1,
            rotation:
                0
        };
    }

    getSelected() {
        return (
            this.objects.find(
                (object) =>
                    object.id ===
                    this.selectedId
            ) ||
            null
        );
    }

    scaleSelected(factor) {
        const object =
            this.getSelected();

        if (!object) return;

        object.scale =
            Math.max(
                .25,
                Math.min(
                    4,
                    (
                        object.scale ||
                        1
                    ) *
                    factor
                )
            );

        this.redraw();
        this.scheduleAutoSave();
    }

    rotateSelected(degrees) {
        const object =
            this.getSelected();

        if (!object) return;

        object.rotation =
            (
                object.rotation ||
                0
            ) +
            degrees;

        this.redraw();
        this.scheduleAutoSave();
    }

    deleteSelected() {
        if (!this.selectedId) return;

        this.objects =
            this.objects.filter(
                (object) =>
                    object.id !==
                    this.selectedId
            );

        this.selectedId = null;
        this.redraw();
        this.scheduleAutoSave();
    }

    undo() {
        if (!this.objects.length) {
            return;
        }

        this.objects.pop();
        this.selectedId = null;
        this.redraw();
        this.scheduleAutoSave();
    }

    redraw(options = {}) {
        if (
            !this.context ||
            !this.image
        ) {
            return;
        }

        const showSelection =
            options.showSelection !==
            false;

        this.context.clearRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );

        this.context.drawImage(
            this.image,
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );

        this.objects.forEach(
            (object) => {
                this.drawObject(
                    object,
                    showSelection &&
                    object.id ===
                    this.selectedId
                );
            }
        );
    }

    drawObject(
        object,
        selected
    ) {
        const context =
            this.context;

        context.save();

        const scale =
            object.scale || 1;

        const rotation =
            (
                object.rotation ||
                0
            ) *
            Math.PI /
            180;

        context.translate(
            object.x,
            object.y
        );

        context.rotate(
            rotation
        );

        context.scale(
            scale,
            scale
        );

        context.strokeStyle =
            object.color ||
            "#64f0e5";

        context.fillStyle =
            object.color ||
            "#64f0e5";

        context.lineWidth =
            object.lineWidth ||
            6;

        context.lineCap =
            "round";

        context.lineJoin =
            "round";

        if (
            object.type ===
            "line"
        ) {
            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(
                object.width,
                object.height
            );
            context.stroke();
        }

        if (
            object.type ===
            "circle"
        ) {
            context.beginPath();
            context.ellipse(
                object.width / 2,
                object.height / 2,
                Math.abs(
                    object.width
                ) / 2,
                Math.abs(
                    object.height
                ) / 2,
                0,
                0,
                Math.PI * 2
            );
            context.stroke();
        }

        if (
            object.type ===
            "arrow"
        ) {
            this.drawArrow(
                context,
                object.width,
                object.height,
                object.lineWidth ||
                6
            );
        }

        if (
            object.type ===
            "text"
        ) {
            const size =
                Math.max(
                    22,
                    this.canvas.width *
                    .025
                );

            context.font =
                `${size}px Arial`;

            context.lineWidth =
                Math.max(
                    3,
                    (
                        object.lineWidth ||
                        6
                    ) /
                    2
                );

            context.strokeStyle =
                "#07111f";

            context.strokeText(
                object.text,
                0,
                0
            );

            context.fillStyle =
                object.color ||
                "#64f0e5";

            context.fillText(
                object.text,
                0,
                0
            );
        }

        if (selected) {
            const bounds =
                this.localBounds(
                    object
                );

            context.save();
            context.strokeStyle =
                "#ffffff";
            context.lineWidth =
                2 / scale;
            context.setLineDash(
                [8 / scale, 6 / scale]
            );
            context.strokeRect(
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height
            );
            context.restore();
        }

        context.restore();
    }

    drawArrow(
        context,
        width,
        height,
        lineWidth
    ) {
        const headLength =
            Math.max(
                16,
                lineWidth * 3
            );

        const angle =
            Math.atan2(
                height,
                width
            );

        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(
            width,
            height
        );
        context.stroke();

        context.beginPath();
        context.moveTo(
            width,
            height
        );
        context.lineTo(
            width -
            headLength *
            Math.cos(
                angle -
                Math.PI / 6
            ),
            height -
            headLength *
            Math.sin(
                angle -
                Math.PI / 6
            )
        );
        context.lineTo(
            width -
            headLength *
            Math.cos(
                angle +
                Math.PI / 6
            ),
            height -
            headLength *
            Math.sin(
                angle +
                Math.PI / 6
            )
        );
        context.closePath();
        context.fill();
    }

    localBounds(object) {
        if (
            object.type ===
            "text"
        ) {
            const width =
                this.context.measureText(
                    object.text || ""
                ).width;

            return {
                x: -5,
                y: -32,
                width:
                    Math.max(
                        width,
                        50
                    ) + 10,
                height:
                    42
            };
        }

        return {
            x:
                Math.min(
                    0,
                    object.width
                ) - 8,
            y:
                Math.min(
                    0,
                    object.height
                ) - 8,
            width:
                Math.abs(
                    object.width
                ) + 16,
            height:
                Math.abs(
                    object.height
                ) + 16
        };
    }

    findObjectAt(point) {
        for (
            let index =
                this.objects.length - 1;
            index >= 0;
            index -= 1
        ) {
            const object =
                this.objects[index];

            const dx =
                point.x -
                object.x;

            const dy =
                point.y -
                object.y;

            const rotation =
                -(
                    object.rotation ||
                    0
                ) *
                Math.PI /
                180;

            const scale =
                object.scale || 1;

            const localX =
                (
                    dx *
                    Math.cos(rotation) -
                    dy *
                    Math.sin(rotation)
                ) /
                scale;

            const localY =
                (
                    dx *
                    Math.sin(rotation) +
                    dy *
                    Math.cos(rotation)
                ) /
                scale;

            const bounds =
                this.localBounds(
                    object
                );

            if (
                localX >=
                bounds.x - 15 &&
                localX <=
                bounds.x +
                bounds.width +
                15 &&
                localY >=
                bounds.y - 15 &&
                localY <=
                bounds.y +
                bounds.height +
                15
            ) {
                return object;
            }
        }

        return null;
    }

    syncControls(object) {
        if (!object) return;

        this.color =
            object.color ||
            this.color;

        this.lineWidth =
            object.lineWidth ||
            this.lineWidth;

        this.modal
            .querySelector(
                "[data-editor-color]"
            )
            .value =
                this.color;

        this.modal
            .querySelector(
                "[data-editor-width]"
            )
            .value =
                this.lineWidth;
    }

    scheduleAutoSave() {
        const status =
            this.modal.querySelector(
                "[data-editor-status]"
            );

        status.textContent =
            "Salvando alterações...";

        clearTimeout(
            this.autoSaveTimer
        );

        this.autoSaveTimer =
            setTimeout(
                () => {
                    this.save(true);
                },
                500
            );
    }

    save(silent = false) {
        /*
         * Exporta sem a moldura de seleção,
         * mas preserva selectedId na interface.
         */
        this.redraw({
            showSelection: false
        });

        const dataUrl =
            this.canvas.toDataURL(
                "image/jpeg",
                .88
            );

        const updated = {
            ...this.sourceEvidence,
            edited_src:
                dataUrl,
            editor_objects:
                JSON.parse(
                    JSON.stringify(
                        this.objects
                    )
                ),
            edited_at:
                new Date().toISOString()
        };

        this.sourceEvidence =
            updated;

        if (this.onSave) {
            this.onSave(
                updated
            );
        }

        this.redraw({
            showSelection: true
        });

        const status =
            this.modal.querySelector(
                "[data-editor-status]"
            );

        status.textContent =
            "Alterações salvas";

        if (!silent) {
            this.close();
        }
    }

    point(event) {
        const rect =
            this.canvas.getBoundingClientRect();

        return {
            x:
                (
                    event.clientX -
                    rect.left
                ) *
                (
                    this.canvas.width /
                    rect.width
                ),
            y:
                (
                    event.clientY -
                    rect.top
                ) *
                (
                    this.canvas.height /
                    rect.height
                )
        };
    }

    loadImage(src) {
        return new Promise(
            (resolve, reject) => {
                const image =
                    new Image();

                image.onload =
                    () => resolve(image);

                image.onerror =
                    reject;

                image.src =
                    src;
            }
        );
    }

    uid() {
        return [
            "editor-object",
            Date.now(),
            Math.random()
                .toString(16)
                .slice(2)
        ].join("-");
    }
}

global.PhotoEditor =
    PhotoEditor;

})(window);
