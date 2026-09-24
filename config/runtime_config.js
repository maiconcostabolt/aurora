(function (global) {
"use strict";

global.AURORA_RUNTIME_CONFIG = {
    app: {
        title: "AURORA",
        subtitle: "Inspeções inteligentes",
        build_id: "AURORA V47 RC1 R59 CANONICAL REPORT COMPACTION",
        user_name: "",
        profile: ""
    },

    storage: {
        case_key: "aurora_v2_current_case",
        settings_key: "aurora_v2_settings"
    },

    default_case: {
        id: "ATD-MOBILE-001",
        profile_id: "",

        customer: {
            name: "",
            phone: "",
            email: "",
            person_type: "Pessoa Física"
        },

        asset: {
            identification: "",
            plate: "",
            year_model: "",
            color: "",
            mileage: "",
            notes: ""
        },

        intake: {
            reason: "",
            initial_condition: "",
            customer_request: "",
            responsible: "",
            entry_date: "",
            priority: "Normal",
            confirmed: false
        },

        occurrence: {
            item: "",
            title: "",
            description: "",
            severity: "",
            recommendation: "",
            follow_up: false
        },

        evidences: [],

        diagnostic: {
            summary: "",
            conclusion: "",
            scope: "",
            limitations: "",
            requires_approval: false
        },

        approval: {
            status: "Pendente",
            approved_by: "",
            approval_date: "",
            notes: "",
            signature_confirmed: false
        }
    }
};

})(window);
