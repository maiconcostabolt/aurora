/**
 * ==========================================================
 * Aurora Core
 * ----------------------------------------------------------
 * Profile Engine
 * ----------------------------------------------------------
 * Gerencia os perfis carregados pela Aurora.
 * ==========================================================
 */

(function (global) {

    "use strict";

    class ProfileEngine {

        constructor(loader = null) {

            this.loader = loader;

            this.profiles = new Map();

        }

        /**
         * Registra um perfil manualmente.
         */

        register(profile) {

            if (!profile) {

                throw new Error("Perfil inválido.");

            }

            if (!profile.id) {

                throw new Error("Perfil sem id.");

            }

            this.profiles.set(profile.id, profile);

            return profile;

        }

        /**
         * Carrega um perfil utilizando o Loader.
         */

        async load(profileId) {

            if (!this.loader) {

                throw new Error(

                    "Nenhum ProfileLoader foi informado."

                );

            }

            const profile =

                await this.loader.load(profileId);

            this.register(profile);

            return profile;

        }

        /**
         * Obtém um perfil.
         */

        get(id) {

            return this.profiles.get(id) || null;

        }

        /**
         * Lista todos.
         */

        getAll() {

            return [...this.profiles.values()];

        }

        /**
         * Existe?
         */

        exists(id) {

            return this.profiles.has(id);

        }

        /**
         * Quantidade.
         */

        count() {

            return this.profiles.size;

        }

        /**
         * Limpa registros.
         */

        clear() {

            this.profiles.clear();

        }

    }

    global.ProfileEngine = ProfileEngine;

})(window);