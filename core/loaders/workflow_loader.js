/**
 * ==========================================================
 * Aurora Core
 * Workflow Loader
 * ==========================================================
 *
 * Responsável por carregar workflows.
 *
 * Não interpreta.
 * Não valida.
 * Não navega.
 *
 * Apenas lê JSON.
 *
 * ==========================================================
 */

(function (global) {

"use strict";

class WorkflowLoader{

    constructor(basePath="../config/workflows"){

        this.basePath=basePath;

    }

    async load(profileId){

        const response=
        await fetch(
            `${this.basePath}/${profileId}.json`
        );

        if(!response.ok){

            throw new Error(
                `Workflow '${profileId}' não encontrado.`
            );

        }

        return await response.json();

    }

}

global.WorkflowLoader=
WorkflowLoader;

})(window);