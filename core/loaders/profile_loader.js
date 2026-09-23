/**
 * ==========================================================
 * Aurora Core
 * ----------------------------------------------------------
 * Profile Loader
 * ----------------------------------------------------------
 *
 * Responsável por carregar arquivos JSON de perfis.
 *
 * Não realiza validações.
 * Não registra perfis.
 * Apenas lê arquivos.
 *
 * ==========================================================
 */

(function (global) {

    "use strict";

    class ProfileLoader {

        constructor(basePath = "../config/profiles") {

            this.basePath = basePath;

        }

        /**
         * Carrega um perfil.
         */

        async load(profileId) {

            const response = await fetch(

                `${this.basePath}/${profileId}.json`

            );

            if (!response.ok) {

                throw new Error(

                    `Perfil '${profileId}' não encontrado.`

                );

            }

            return await response.json();

        }

    }

    global.ProfileLoader = ProfileLoader;

})(window);