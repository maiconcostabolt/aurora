(function (global) {
"use strict";

function pickString() {
    for (let index = 0; index < arguments.length; index += 1) {
        const value = arguments[index];
        const text = String(value == null ? "" : value).trim();
        if (text) {
            return text;
        }
    }
    return "";
}

function buildCompanyFromIdentity(identity) {
    const raw = identity && typeof identity === "object"
        ? identity
        : {};

    return {
        name:
            pickString(
                raw.company,
                raw.company_name,
                raw.business_name,
                raw.organization_name
            ) || "AURORA",
        professional:
            pickString(
                raw.professional,
                raw.responsible,
                raw.full_name,
                raw.name
            ) || "Usuário",
        phone: pickString(raw.phone),
        whatsapp: pickString(raw.whatsapp),
        email: pickString(raw.email),
        city: pickString(raw.city),
        state: pickString(raw.state),
        address: pickString(raw.address),
        zip_code: pickString(raw.zip_code),
        document: pickString(raw.document),
        registration: pickString(raw.registration),
        website: pickString(raw.website),
        description: pickString(raw.description),
        specialties: pickString(raw.specialties),
        tagline: pickString(raw.tagline, raw.slogan, raw.subtitle),
        logo: pickString(raw.logo),
        logo_report_scale: Math.max(200, Math.min(300, Number(raw.logo_report_scale) || 200)),
        cover_photo_report_scale: Math.max(150, Math.min(250, Number(raw.cover_photo_report_scale) || 150))
    };
}

function mergeCompany(liveIdentity, snapshot) {
    const live = buildCompanyFromIdentity(liveIdentity);
    const snap = snapshot && typeof snapshot === "object"
        ? snapshot
        : {};
    const merged = Object.assign({}, snap);

    merged.name = pickString(
        liveIdentity && liveIdentity.company,
        snap.name,
        live.name !== "AURORA" ? live.name : ""
    ) || "AURORA";

    merged.professional = pickString(
        liveIdentity && liveIdentity.professional,
        snap.professional,
        live.professional !== "Usuário" ? live.professional : ""
    ) || "Usuário";

    merged.logo = pickString(
        liveIdentity && liveIdentity.logo,
        snap.logo
    );
    merged.logo_report_scale = Math.max(200, Math.min(300, Number((liveIdentity && liveIdentity.logo_report_scale) || snap.logo_report_scale) || 200));
    merged.cover_photo_report_scale = Math.max(150, Math.min(250, Number((liveIdentity && liveIdentity.cover_photo_report_scale) || snap.cover_photo_report_scale) || 150));

    [
        "phone",
        "whatsapp",
        "email",
        "city",
        "state",
        "address",
        "zip_code",
        "document",
        "registration",
        "website",
        "description",
        "specialties",
        "tagline"
    ].forEach((field) => {
        merged[field] = pickString(
            liveIdentity && liveIdentity[field],
            snap[field]
        );
    });

    return merged;
}

function resolveVehicleInspectionResponsible(intake, company, reportOrCase) {
    const source =
        reportOrCase && typeof reportOrCase === "object"
            ? reportOrCase
            : null;
    const snapshot =
        source &&
        source.snapshot &&
        typeof source.snapshot === "object"
            ? source.snapshot
            : null;

    return pickString(
        source && source.performed_by_name,
        snapshot && snapshot.performed_by_name,
        intake && intake.responsible,
        intake && intake.inspection_responsible
    );
}

global.AuroraReportCompanyIdentity = {
    pickString,
    buildCompanyFromIdentity,
    mergeCompany,
    resolveVehicleInspectionResponsible
};

})(window);
