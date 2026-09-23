const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = {};
const source = fs.readFileSync(path.resolve(__dirname, "../../core/reporting/report_preview.js"), "utf8");
vm.runInThisContext(source, { filename: "report_preview.js" });

const image = (label, color) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760"><rect width="100%" height="100%" fill="${color}"/><rect x="55" y="55" width="1090" height="650" rx="32" fill="none" stroke="#ffffff" stroke-width="8"/><text x="600" y="360" text-anchor="middle" font-family="Arial" font-size="70" font-weight="700" fill="#ffffff">${label}</text><text x="600" y="440" text-anchor="middle" font-family="Arial" font-size="30" fill="#ffffff">AURORA • Vistoria veicular</text></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

const photos = {
    front: image("FRENTE", "#1d9189"),
    right: image("LATERAL DIREITA", "#244f6b"),
    rear: image("TRASEIRA", "#3b657f"),
    left: image("LATERAL ESQUERDA", "#397f78"),
    issue1: image("AVARIA • DETALHE 1", "#a13a4d"),
    issue2: image("AVARIA • DETALHE 2", "#bf586a"),
    panel: image("PAINEL / KM", "#455568")
};

const report = {
    id: "qa-v114",
    public_id: "AUR-2026-0814",
    created_at: "2026-08-13T22:30:00-03:00",
    report_title: "Vistoria veicular de recebimento",
    profile_id: "workshop",
    service: { id: "vehicle_inspection", title: "Vistoria veicular" },
    company: { name: "Aurora Oficina", professional: "Maicon Costa" },
    customer: { name: "Cliente de teste", phone: "(47) 99999-9999" },
    asset: {
        identification: "Honda Civic Touring",
        plate: "ABC-1D23",
        year_model: "2025 / 2026",
        color: "Prata",
        mileage: "12.540 km",
        work_order: "OS-1842",
        fuel_level: "3/4",
        spare_tire: "Presente"
    },
    intake: {
        requested_services: ["Revisão preventiva", "Alinhamento e balanceamento"],
        received_items: ["Manual e documentos", "Chave reserva", "Triângulo"],
        internal_external: "OK",
        windshield: "Atenção",
        levels: "OK",
        brakes: "OK",
        tires: "OK",
        suspension_steering: "OK",
        battery: "OK",
        safety_items: "OK",
        responsible: "Maicon Costa",
        entry_date: "13/08/2026",
        entry_time: "22:30"
    },
    diagnostic: { summary: "Veículo recebido e vistoriado.", recommendation: "Reparar a avaria registrada antes da entrega." },
    occurrences: [
        { title: "Foto Frente", record_kind: "vehicle_guided_photo", vehicle_photo_slot: "front", photos: [{ src: photos.front }, { src: photos.issue2 }] },
        { title: "Foto Lateral direita", photos: [{ src: photos.right }] },
        { title: "Foto Traseira", photos: [{ src: photos.rear }] },
        { title: "Foto Lateral esquerda", photos: [{ src: photos.left }] },
        { title: "Risco no para-choque traseiro", item: "Para-choque traseiro", severity: "Média", description: "Risco superficial localizado no canto direito.", recommendation: "Realizar polimento técnico e reavaliar.", photos: [{ src: photos.issue1 }, { src: photos.issue2 }] },
        { title: "Amassado na porta dianteira", item: "Porta dianteira", severity: "Alta", description: "Deformação localizada próxima ao vinco central.", recommendation: "Avaliar funilaria.", photos: [{ src: photos.issue2 }] },
        { title: "Foto Painel / km", item: "Painel de instrumentos", description: "Quilometragem confirmada no recebimento.", photos: [{ src: photos.panel }] }
    ],
    show_severity: true,
    show_record_labels: true
};

const preview = new window.ReportPreview({ engine: {} });
const html = preview._standaloneHTML(report);
fs.mkdirSync(__dirname, { recursive: true });
fs.writeFileSync(path.join(__dirname, "vehicle_report_v114_qa.html"), html);
console.log(path.join(__dirname, "vehicle_report_v114_qa.html"));
