(function (global) {
"use strict";

/**
 * FASE OFFLINE 1 — chave PÚBLICA somente.
 * A chave privada fica exclusivamente no secret Supabase LICENSE_TICKET_PRIVATE_JWK.
 *
 * Public JWK espelhada de config/license_public_key.generated.json.
 * Nunca cole a chave privada (d) neste arquivo.
 */
global.AURORA_LICENSE_CONFIG = {
    kid: "aurora-license-v1",
    algorithm: "EdDSA",
    edge_function: "aurora_issue_license_ticket_pwa_test",
    default_grace_hours: 24,
    offline_license_v1: true,
    offline_monotonic_v1: true,
    clock_skew_tolerance_ms: 300000,
    public_jwk: {
        key_ops: [
            "verify"
        ],
        ext: true,
        alg: "EdDSA",
        crv: "Ed25519",
        x: "u6xBska3L91e_MxNvUL20lkFYdgMOWGph_KqtPp-LQA",
        kty: "OKP",
        kid: "aurora-license-v1"
    }
};

})(window);
