export const productCategories = [
  "GaN & SiC",
  "Evaluation hardware",
  "Test & measurement",
  "Power supplies & loads",
  "Sensors & protection",
  "Magnetics & passives",
  "Thermal management",
] as const;

export type ProductCategory = (typeof productCategories)[number];

export type ProductAvailability = "In stock" | "Lead time" | "Request quote";

export type CatalogProduct = {
  readonly slug: string;
  readonly sku: string;
  readonly name: string;
  readonly maker: string;
  readonly category: ProductCategory;
  readonly summary: string;
  readonly priceCents: number;
  readonly availability: ProductAvailability;
  readonly fulfillment: string;
  readonly leadTime: string;
  readonly badges: readonly string[];
  readonly specs: readonly { readonly label: string; readonly value: string }[];
  readonly visual: "gan" | "module" | "instrument" | "supply" | "sensor" | "magnetic" | "thermal";
  readonly featured: boolean;
};

export const products: readonly CatalogProduct[] = [
  {
    slug: "infineon-igt60r070d1",
    sku: "TS-IGT60R070D1",
    name: "CoolGaN 650 V G5 transistor",
    maker: "Infineon",
    category: "GaN & SiC",
    summary: "Enhancement-mode GaN power transistor selected for high-frequency soft-switching stages.",
    priceCents: 1840,
    availability: "In stock",
    fulfillment: "Authorized distribution",
    leadTime: "Ships in 1–2 business days",
    badges: ["650 V", "Top-side cooled"],
    specs: [
      { label: "VDS", value: "650 V" },
      { label: "RDS(on)", value: "70 mΩ typ." },
      { label: "Package", value: "TOLT" },
    ],
    visual: "gan",
    featured: true,
  },
  {
    slug: "ti-ucc21530dwk",
    sku: "TS-UCC21530DWK",
    name: "UCC21530 isolated gate driver",
    maker: "Texas Instruments",
    category: "GaN & SiC",
    summary: "Reinforced dual-channel isolated gate driver with programmable dead time and high CMTI.",
    priceCents: 892,
    availability: "In stock",
    fulfillment: "Authorized distribution",
    leadTime: "Ships in 1–2 business days",
    badges: ["5.7 kVRMS", "4 A / 6 A"],
    specs: [
      { label: "Isolation", value: "5.7 kVRMS" },
      { label: "CMTI", value: ">100 V/ns" },
      { label: "Package", value: "SOIC-14 DWK" },
    ],
    visual: "gan",
    featured: false,
  },
  {
    slug: "cde-944u161k801abm",
    sku: "TS-944U-800V",
    name: "944U DC-link film capacitor",
    maker: "Cornell Dubilier",
    category: "Magnetics & passives",
    summary: "Low-inductance polypropylene capacitor for pulsed DC-link and resonant power conversion.",
    priceCents: 2860,
    availability: "In stock",
    fulfillment: "Stocked in Ohio",
    leadTime: "Ships in 1–2 business days",
    badges: ["800 VDC", "160 µF"],
    specs: [
      { label: "Capacitance", value: "160 µF" },
      { label: "Voltage", value: "800 VDC" },
      { label: "ESR", value: "2.2 mΩ typ." },
    ],
    visual: "magnetic",
    featured: true,
  },
  {
    slug: "lem-hah1dr-50-sp3",
    sku: "TS-HAH1DR50",
    name: "HAH1DR 50 A current transducer",
    maker: "LEM",
    category: "Sensors & protection",
    summary: "Automotive-grade open-loop Hall sensor for isolated primary current measurement.",
    priceCents: 3840,
    availability: "In stock",
    fulfillment: "Authorized distribution",
    leadTime: "Ships in 2–3 business days",
    badges: ["±150 A peak", "Galvanic isolation"],
    specs: [
      { label: "Nominal current", value: "50 A" },
      { label: "Bandwidth", value: "120 kHz" },
      { label: "Accuracy", value: "±1%" },
    ],
    visual: "sensor",
    featured: false,
  },
  {
    slug: "wurth-llc-transformer-3kw",
    sku: "TS-WE-LLC3K",
    name: "3 kW planar LLC transformer set",
    maker: "Würth Elektronik",
    category: "Magnetics & passives",
    summary: "Matched planar transformer and resonant-inductor set for the Thevenin Works 3 kW LLC build.",
    priceCents: 12900,
    availability: "Lead time",
    fulfillment: "Built to order in Germany",
    leadTime: "Estimated 3–4 weeks",
    badges: ["500 kHz", "4 kVRMS hipot"],
    specs: [
      { label: "Turns ratio", value: "8:1:1" },
      { label: "Power", value: "3.3 kW" },
      { label: "Core", value: "E64/10 planar" },
    ],
    visual: "magnetic",
    featured: true,
  },
  {
    slug: "boyd-microchannel-cold-plate",
    sku: "TS-BOYD-MCP98",
    name: "MCP-98 microchannel cold plate",
    maker: "Boyd",
    category: "Thermal management",
    summary: "Brazed-aluminum liquid cold plate sized for dense GaN and SiC converter assemblies.",
    priceCents: 18600,
    availability: "Lead time",
    fulfillment: "Manufacturer direct",
    leadTime: "Estimated 2–3 weeks",
    badges: ["0.018 °C/W", "Leak tested"],
    specs: [
      { label: "Envelope", value: "98 × 64 mm" },
      { label: "Flow", value: "1.5 L/min" },
      { label: "Fittings", value: "G1/4" },
    ],
    visual: "thermal",
    featured: false,
  },
  {
    slug: "wolfspeed-cab006m12gm3",
    sku: "TS-CAB006M12GM3",
    name: "WolfPACK 1200 V SiC half-bridge",
    maker: "Wolfspeed",
    category: "GaN & SiC",
    summary: "Low-inductance silicon-carbide half-bridge module for traction, charging, and grid converters.",
    priceCents: 34800,
    availability: "In stock",
    fulfillment: "Authorized distribution",
    leadTime: "Ships in 2–3 business days",
    badges: ["1200 V", "6.0 mΩ"],
    specs: [
      { label: "Topology", value: "Half bridge" },
      { label: "Current", value: "186 A" },
      { label: "Isolation", value: "AlN baseplate" },
    ],
    visual: "module",
    featured: true,
  },
  {
    slug: "infineon-eval-3kw-bidi-psfb",
    sku: "TS-EVAL3KWBIDI",
    name: "3 kW bidirectional PSFB evaluation kit",
    maker: "Infineon",
    category: "Evaluation hardware",
    summary: "High-voltage development platform for isolated bidirectional DC/DC control and firmware work.",
    priceCents: 129500,
    availability: "Request quote",
    fulfillment: "Manufacturer direct",
    leadTime: "Allocation confirmed with quote",
    badges: ["3 kW", "400 V ↔ 48 V"],
    specs: [
      { label: "Power", value: "3 kW continuous" },
      { label: "Control", value: "XMC digital" },
      { label: "Cooling", value: "Forced air" },
    ],
    visual: "module",
    featured: false,
  },
  {
    slug: "tektronix-mso56b",
    sku: "TS-MSO56B",
    name: "5 Series B MSO mixed-signal oscilloscope",
    maker: "Tektronix",
    category: "Test & measurement",
    summary: "Six-channel instrument for correlated switching, control-loop, and power-integrity measurements.",
    priceCents: 1865000,
    availability: "Request quote",
    fulfillment: "Factory configured",
    leadTime: "Configuration dependent",
    badges: ["6 channels", "2 GHz option"],
    specs: [
      { label: "Channels", value: "6 FlexChannel" },
      { label: "Sample rate", value: "6.25 GS/s" },
      { label: "Record length", value: "125 Mpoints" },
    ],
    visual: "instrument",
    featured: true,
  },
  {
    slug: "ea-psb-10000-4u",
    sku: "TS-EA-PSB10K",
    name: "PSB 10000 30 kW bidirectional DC source",
    maker: "EA Elektro-Automatik",
    category: "Power supplies & loads",
    summary: "Regenerative source and sink platform for battery, inverter, and high-power converter validation.",
    priceCents: 2789000,
    availability: "Request quote",
    fulfillment: "Factory configured",
    leadTime: "Typical 6–8 weeks",
    badges: ["30 kW", "Regenerative"],
    specs: [
      { label: "Voltage options", value: "60–2000 V" },
      { label: "Efficiency", value: "Up to 96%" },
      { label: "Interface", value: "Ethernet / USB" },
    ],
    visual: "supply",
    featured: true,
  },
  {
    slug: "chroma-63206a-600-420",
    sku: "TS-63206A",
    name: "63206A-600-420 high-power DC load",
    maker: "Chroma",
    category: "Power supplies & loads",
    summary: "Programmable 6 kW electronic load with dynamic loading for converter transient testing.",
    priceCents: 972500,
    availability: "Lead time",
    fulfillment: "Manufacturer direct",
    leadTime: "Estimated 4–6 weeks",
    badges: ["6 kW", "600 V / 420 A"],
    specs: [
      { label: "Power", value: "6 kW" },
      { label: "Modes", value: "CC / CR / CV / CP" },
      { label: "Slew rate", value: "20 A/µs" },
    ],
    visual: "instrument",
    featured: false,
  },
] as const;

export const designCategories = [
  "DC/DC converters",
  "Inverters & motor control",
  "Charging & grid",
  "Instrumentation",
] as const;

export type DesignCategory = (typeof designCategories)[number];
export type VerificationLevel = "Community" | "Built" | "Verified" | "Lab Verified";

export const verificationLevels: readonly VerificationLevel[] = [
  "Community",
  "Built",
  "Verified",
  "Lab Verified",
] as const;

export type BomLine = {
  readonly line: number;
  readonly reference: string;
  readonly quantity: number;
  readonly manufacturer: string;
  readonly mpn: string;
  readonly description: string;
  readonly productSlug?: string;
  readonly unitPriceCents: number;
  readonly sourcing: string;
};

export type BuildTier = {
  readonly id: string;
  readonly name: string;
  readonly priceCents: number;
  readonly summary: string;
  readonly features: readonly string[];
  readonly actionLabel: string;
  readonly recommended?: boolean;
};

export type VerificationRecord = {
  readonly level: VerificationLevel;
  readonly badgeId?: string;
  readonly revision: string;
  readonly verifiedOn?: string;
  readonly lab?: string;
  readonly report?: string;
  readonly summary: string;
  readonly results: readonly {
    readonly label: string;
    readonly value: string;
    readonly note: string;
  }[];
};

export type DesignRevision = {
  readonly version: string;
  readonly date: string;
  readonly status: "Current" | "Superseded";
  readonly verification: VerificationLevel;
  readonly notes: readonly string[];
};

export type MarketplaceDesign = {
  readonly id: number;
  readonly slug: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly category: DesignCategory;
  readonly author: string;
  readonly authorRole: string;
  readonly authorInitials: string;
  readonly summary: string;
  readonly overview: readonly string[];
  readonly publishedOn: string;
  readonly updatedOn: string;
  readonly revision: string;
  readonly license: string;
  readonly tags: readonly string[];
  readonly power: string;
  readonly input: string;
  readonly output: string;
  readonly efficiency: string;
  readonly switchingFrequency: string;
  readonly dimensions: string;
  readonly layers: number;
  readonly drillCount: number;
  readonly stars: number;
  readonly discussionCount: number;
  readonly downloadCount: number;
  readonly fileSize: string;
  readonly includedFiles: readonly string[];
  readonly applications: readonly string[];
  readonly highlights: readonly string[];
  readonly safetyNote: string;
  readonly verification: VerificationRecord;
  readonly revisions: readonly DesignRevision[];
  readonly bom: readonly BomLine[];
  readonly tiers: readonly BuildTier[];
  readonly visual: "copper" | "violet" | "blue" | "graphite";
  readonly featured: boolean;
};

export const designs: readonly MarketplaceDesign[] = [
  {
    id: 1742,
    slug: "gan-3kw-llc-converter",
    title: "3 kW 400 V-to-48 V GaN LLC DC/DC Converter",
    shortTitle: "3 kW GaN LLC DC/DC",
    category: "DC/DC converters",
    author: "Elena Park",
    authorRole: "Power electronics engineer",
    authorInitials: "EP",
    summary: "A production-oriented, liquid-cooled resonant converter with measured 97.8% peak efficiency and complete manufacturing data.",
    overview: [
      "This isolated LLC converter is designed as a compact 400 V bus to 48 V building block for data-center, robotics, and stationary-storage systems. The primary uses 650 V GaN switches with a planar transformer and synchronous secondary rectification.",
      "Revision 1.4.2 packages the complete electrical, mechanical, firmware, simulation, and test workflow. The archived lab report is tied to this exact revision; later edits do not inherit its badge.",
    ],
    publishedOn: "2026-05-14",
    updatedOn: "2026-07-21",
    revision: "1.4.2",
    license: "Commercial build license",
    tags: ["GaN", "LLC", "400 V", "48 V", "planar magnetics", "data center"],
    power: "3.0 kW",
    input: "300–420 VDC",
    output: "48 V / 62.5 A",
    efficiency: "97.8% peak",
    switchingFrequency: "360–510 kHz",
    dimensions: "98.4 × 64.0 mm",
    layers: 12,
    drillCount: 226,
    stars: 482,
    discussionCount: 37,
    downloadCount: 1264,
    fileSize: "18.4 MB",
    includedFiles: [
      "KiCad 9 schematic and PCB source",
      "Gerber X2, IPC-356, drill, and ODB++ fabrication package",
      "PLECS switching and thermal models",
      "STM32G4 control firmware and bootloader",
      "Pick-and-place, assembly drawings, and revisioned BOM",
      "Calibration procedure, raw test data, and lab report",
    ],
    applications: ["AI rack 48 V power shelves", "Stationary storage", "Robotics power distribution", "Industrial DC microgrids"],
    highlights: [
      "12-layer, 2 oz hybrid stack-up with embedded capacitance",
      "Primary-secondary reinforced isolation and 4 kVRMS hipot margin",
      "Digital frequency control with burst-mode light-load operation",
      "Thermal model correlated to a 1.5 L/min liquid loop",
    ],
    safetyNote: "Hazardous DC bus voltage is present during operation. This design is intended for qualified engineers with suitable isolation, interlocks, PPE, and test equipment.",
    verification: {
      level: "Lab Verified",
      badgeId: "LV-1742-142",
      revision: "1.4.2",
      verifiedOn: "2026-07-18",
      lab: "Thevenin Verification Lab — Columbus, OH",
      report: "TVL-26-1742-R142",
      summary: "An independent build from released manufacturing files passed the published power, efficiency, transient, thermal, and isolation plan.",
      results: [
        { label: "Peak efficiency", value: "97.8%", note: "400 V in, 48 V / 41 A out" },
        { label: "Full-load efficiency", value: "97.1%", note: "400 V in, 3.0 kW out" },
        { label: "Load transient", value: "+1.7 / −1.9 V", note: "20–80% step, 2.5 A/µs" },
        { label: "Thermal soak", value: "71.4 °C max", note: "45 °C coolant, 3 kW, 60 min" },
      ],
    },
    revisions: [
      {
        version: "1.4.2",
        date: "2026-07-21",
        status: "Current",
        verification: "Lab Verified",
        notes: ["Added secondary snubber tuning from lab data", "Locked fabrication notes and calibration constants"],
      },
      {
        version: "1.4.1",
        date: "2026-06-30",
        status: "Superseded",
        verification: "Built",
        notes: ["Moved current-sense return away from SR gate loop", "Updated cold-plate mounting tolerance"],
      },
      {
        version: "1.3.0",
        date: "2026-05-14",
        status: "Superseded",
        verification: "Verified",
        notes: ["First public release", "External peer review completed"],
      },
    ],
    bom: [
      { line: 1, reference: "Q1–Q8", quantity: 8, manufacturer: "Infineon", mpn: "IGT60R070D1", description: "650 V CoolGaN G5 power transistor", productSlug: "infineon-igt60r070d1", unitPriceCents: 1840, sourcing: "46 available" },
      { line: 2, reference: "U3–U6", quantity: 4, manufacturer: "Texas Instruments", mpn: "UCC21530DWK", description: "Reinforced isolated dual gate driver", productSlug: "ti-ucc21530dwk", unitPriceCents: 892, sourcing: "112 available" },
      { line: 3, reference: "C1–C6", quantity: 6, manufacturer: "Cornell Dubilier", mpn: "944U161K801ABM", description: "160 µF, 800 V polypropylene DC-link capacitor", productSlug: "cde-944u161k801abm", unitPriceCents: 2860, sourcing: "28 available" },
      { line: 4, reference: "T1, LR1", quantity: 1, manufacturer: "Würth Elektronik", mpn: "WE-LLC3K-811", description: "Planar transformer and resonant-inductor set", productSlug: "wurth-llc-transformer-3kw", unitPriceCents: 12900, sourcing: "3–4 week lead" },
      { line: 5, reference: "U11", quantity: 1, manufacturer: "LEM", mpn: "HAH1DR 50-S/SP3", description: "Isolated Hall current transducer", productSlug: "lem-hah1dr-50-sp3", unitPriceCents: 3840, sourcing: "67 available" },
      { line: 6, reference: "CP1", quantity: 1, manufacturer: "Boyd", mpn: "MCP-98-G14", description: "Microchannel liquid cold plate", productSlug: "boyd-microchannel-cold-plate", unitPriceCents: 18600, sourcing: "2–3 week lead" },
      { line: 7, reference: "R, C, L, U misc.", quantity: 1, manufacturer: "Multiple", mpn: "TW-1742-PASSIVES", description: "Qualified control, sensing, and passive component lot", unitPriceCents: 18420, sourcing: "Kit stock" },
    ],
    tiers: [
      {
        id: "files",
        name: "Design files",
        priceCents: 4900,
        summary: "For engineers sourcing and building independently.",
        features: ["All native source files", "Commercial prototype license", "Revision updates for one year"],
        actionLabel: "License design files",
      },
      {
        id: "bom-kit",
        name: "PCB + components",
        priceCents: 39900,
        summary: "Fabricated PCBs and a traceable, revision-matched BOM kit.",
        features: ["Two impedance-controlled PCBs", "Complete component set", "Lot and substitution record"],
        actionLabel: "Add build kit",
        recommended: true,
      },
      {
        id: "development-kit",
        name: "Complete development kit",
        priceCents: 185000,
        summary: "Assembled converter, controller, cooling hardware, and bring-up fixtures.",
        features: ["Assembled and inspected hardware", "Programmer and interface boards", "Cold plate and cable set"],
        actionLabel: "Request development kit",
      },
    ],
    visual: "copper",
    featured: true,
  },
  {
    id: 1688,
    slug: "sic-22kw-traction-inverter",
    title: "22 kW 800 V SiC Traction Inverter",
    shortTitle: "22 kW SiC Traction Inverter",
    category: "Inverters & motor control",
    author: "Marcus Liu",
    authorRole: "Motor drives consultant",
    authorInitials: "ML",
    summary: "A compact three-phase inverter with resolver interface, field-oriented control, and double-pulse characterization data.",
    overview: ["A 1200 V SiC traction inverter platform for light-EV and dynamometer research, with open control firmware and a revisioned switching-loss model."],
    publishedOn: "2026-03-04",
    updatedOn: "2026-08-02",
    revision: "2.1.0",
    license: "Commercial build license",
    tags: ["SiC", "traction", "FOC", "800 V", "three phase"],
    power: "22 kW",
    input: "450–850 VDC",
    output: "3-phase / 180 Arms",
    efficiency: "98.6% peak",
    switchingFrequency: "10–30 kHz",
    dimensions: "248 × 176 mm",
    layers: 8,
    drillCount: 384,
    stars: 318,
    discussionCount: 54,
    downloadCount: 744,
    fileSize: "42.1 MB",
    includedFiles: ["Altium source and fabrication package", "STM32H7 FOC firmware", "Double-pulse and dyno datasets", "Mechanical enclosure drawings"],
    applications: ["Light electric vehicles", "Motor dynamometers", "Aerospace ground support"],
    highlights: ["Laminated DC link", "Resolver and encoder interfaces", "Desaturation and active-short-circuit protection"],
    safetyNote: "Operation requires high-voltage laboratory controls and a qualified motor-drive test setup.",
    verification: {
      level: "Verified",
      revision: "2.1.0",
      verifiedOn: "2026-07-29",
      summary: "Peer-reviewed files and creator-supplied dynamometer results have been checked against the published test method.",
      results: [
        { label: "Peak efficiency", value: "98.6%", note: "650 VDC, 12 kW" },
        { label: "Phase current", value: "180 Arms", note: "30 s demonstrated" },
      ],
    },
    revisions: [
      { version: "2.1.0", date: "2026-08-02", status: "Current", verification: "Verified", notes: ["Added active-short-circuit firmware", "Updated gate resistor table"] },
      { version: "2.0.0", date: "2026-03-04", status: "Superseded", verification: "Built", notes: ["Initial marketplace release"] },
    ],
    bom: [
      { line: 1, reference: "PM1–PM3", quantity: 3, manufacturer: "Wolfspeed", mpn: "CAB006M12GM3", description: "1200 V SiC half-bridge module", productSlug: "wolfspeed-cab006m12gm3", unitPriceCents: 34800, sourcing: "19 available" },
      { line: 2, reference: "CP1", quantity: 1, manufacturer: "Boyd", mpn: "MCP-98-G14", description: "Liquid cold plate", productSlug: "boyd-microchannel-cold-plate", unitPriceCents: 18600, sourcing: "2–3 week lead" },
      { line: 3, reference: "Control + passives", quantity: 1, manufacturer: "Multiple", mpn: "TW-1688-CONTROL", description: "Controller, isolated supplies, sensors, and passives", unitPriceCents: 48200, sourcing: "Kit stock" },
    ],
    tiers: [
      { id: "files", name: "Design files", priceCents: 9500, summary: "Native electrical, mechanical, and firmware source.", features: ["Commercial prototype license", "Dyno data", "One year of updates"], actionLabel: "License design files" },
      { id: "bom-kit", name: "PCB + components", priceCents: 149500, summary: "Revision-matched power and control hardware kit.", features: ["Fabricated PCB set", "SiC modules", "Traceable BOM"], actionLabel: "Request build kit", recommended: true },
      { id: "development-kit", name: "Complete development kit", priceCents: 695000, summary: "Assembled inverter and commissioning harness.", features: ["Assembled power stage", "Controller and harness", "Factory acceptance record"], actionLabel: "Request development kit" },
    ],
    visual: "violet",
    featured: true,
  },
  {
    id: 1806,
    slug: "bidirectional-6kw-onboard-charger",
    title: "6.6 kW Bidirectional Onboard Charger",
    shortTitle: "6.6 kW Bidirectional OBC",
    category: "Charging & grid",
    author: "Northline Power Lab",
    authorRole: "Verified engineering studio",
    authorInitials: "NP",
    summary: "Two-stage, single-phase charger with GaN totem-pole PFC, CLLC isolation, and vehicle-to-home firmware hooks.",
    overview: ["An engineering platform for bidirectional charging research with a modular control board and complete conducted-EMI pre-compliance records."],
    publishedOn: "2026-06-11",
    updatedOn: "2026-08-12",
    revision: "1.2.0",
    license: "Commercial build license",
    tags: ["GaN", "CLLC", "PFC", "V2H", "charging"],
    power: "6.6 kW",
    input: "180–264 VAC",
    output: "250–450 VDC",
    efficiency: "96.9% peak",
    switchingFrequency: "65–300 kHz",
    dimensions: "286 × 190 mm",
    layers: 10,
    drillCount: 512,
    stars: 226,
    discussionCount: 29,
    downloadCount: 418,
    fileSize: "67.8 MB",
    includedFiles: ["OrCAD source and Gerber X2", "PFC and CLLC firmware", "EMI scans", "CAN database and test scripts"],
    applications: ["EV charging research", "Vehicle-to-home", "Stationary battery systems"],
    highlights: ["Bidirectional power flow", "Interleaved totem-pole PFC", "Conducted-EMI pre-scan package"],
    safetyNote: "Mains and battery potentials are hazardous. Use certified isolation and protection appropriate to the target product.",
    verification: {
      level: "Built",
      revision: "1.2.0",
      verifiedOn: "2026-08-09",
      summary: "The creator has documented a functioning hardware build; independent verification has not yet been commissioned.",
      results: [
        { label: "Peak efficiency", value: "96.9%", note: "Creator measurement" },
        { label: "Power", value: "6.6 kW", note: "30-minute run" },
      ],
    },
    revisions: [
      { version: "1.2.0", date: "2026-08-12", status: "Current", verification: "Built", notes: ["Added reverse-power firmware hooks", "Updated EMI filter damping"] },
      { version: "1.0.0", date: "2026-06-11", status: "Superseded", verification: "Community", notes: ["Initial marketplace release"] },
    ],
    bom: [
      { line: 1, reference: "Q1–Q12", quantity: 12, manufacturer: "Infineon", mpn: "IGT60R070D1", description: "650 V CoolGaN G5 power transistor", productSlug: "infineon-igt60r070d1", unitPriceCents: 1840, sourcing: "46 available" },
      { line: 2, reference: "C1–C4", quantity: 4, manufacturer: "Cornell Dubilier", mpn: "944U161K801ABM", description: "800 V DC-link film capacitor", productSlug: "cde-944u161k801abm", unitPriceCents: 2860, sourcing: "28 available" },
      { line: 3, reference: "Control + magnetics", quantity: 1, manufacturer: "Multiple", mpn: "TW-1806-KIT", description: "Qualified control, magnetic, and passive lot", unitPriceCents: 96200, sourcing: "Kit stock" },
    ],
    tiers: [
      { id: "files", name: "Design files", priceCents: 12900, summary: "Complete charger design and firmware package.", features: ["Native source", "Simulation files", "Commercial prototype license"], actionLabel: "License design files" },
      { id: "bom-kit", name: "PCB + components", priceCents: 289500, summary: "Fabricated boards and revision-matched components.", features: ["PCB set", "Complete BOM", "Sourcing record"], actionLabel: "Request build kit", recommended: true },
      { id: "development-kit", name: "Complete development kit", priceCents: 1285000, summary: "Assembled charger development platform.", features: ["Assembled hardware", "Control and CAN harness", "Bring-up record"], actionLabel: "Request development kit" },
    ],
    visual: "blue",
    featured: false,
  },
  {
    id: 1594,
    slug: "wideband-double-pulse-tester",
    title: "1200 V Wideband Double-Pulse Tester",
    shortTitle: "1200 V Double-Pulse Tester",
    category: "Instrumentation",
    author: "Priya Raman",
    authorRole: "Applications engineer",
    authorInitials: "PR",
    summary: "A modular SiC and GaN switching-characterization fixture with low-inductance adapters and automated capture scripts.",
    overview: ["A configurable double-pulse test platform that prioritizes measurement integrity, probe repeatability, and scripted extraction of switching energy."],
    publishedOn: "2025-11-19",
    updatedOn: "2026-04-26",
    revision: "3.0.1",
    license: "Commercial lab license",
    tags: ["double pulse", "SiC", "GaN", "characterization", "test fixture"],
    power: "1200 V / 400 A",
    input: "0–1200 VDC",
    output: "Device characterization",
    efficiency: "8 ns edge capture",
    switchingFrequency: "Single / burst",
    dimensions: "210 × 160 mm",
    layers: 6,
    drillCount: 198,
    stars: 611,
    discussionCount: 82,
    downloadCount: 1962,
    fileSize: "24.7 MB",
    includedFiles: ["KiCad fixture and adapter source", "Python capture scripts", "Probe deskew procedure", "Example Wolfspeed dataset"],
    applications: ["Device evaluation", "Gate-drive tuning", "Switching-loss model correlation"],
    highlights: ["Interchangeable device cards", "Rogowski and coaxial-shunt support", "Instrument automation scripts"],
    safetyNote: "Stored energy and exposed high voltage can be lethal. A guarded enclosure, dump circuit, and qualified operator are mandatory.",
    verification: {
      level: "Lab Verified",
      badgeId: "LV-1594-301",
      revision: "3.0.1",
      verifiedOn: "2026-04-22",
      lab: "Thevenin Verification Lab — Columbus, OH",
      report: "TVL-26-1594-R301",
      summary: "Fixture parasitics, protection behavior, and automated energy extraction were independently checked on revision 3.0.1.",
      results: [
        { label: "Loop inductance", value: "6.8 nH", note: "Measured at fixture terminals" },
        { label: "Capture repeatability", value: "±1.6%", note: "20 repeated pulses" },
      ],
    },
    revisions: [
      { version: "3.0.1", date: "2026-04-26", status: "Current", verification: "Lab Verified", notes: ["Corrected adapter silkscreen", "Locked capture-script dependencies"] },
      { version: "3.0.0", date: "2026-03-18", status: "Superseded", verification: "Built", notes: ["New low-inductance device adapter"] },
    ],
    bom: [
      { line: 1, reference: "DUT1", quantity: 1, manufacturer: "Wolfspeed", mpn: "CAB006M12GM3", description: "Reference 1200 V SiC half-bridge", productSlug: "wolfspeed-cab006m12gm3", unitPriceCents: 34800, sourcing: "19 available" },
      { line: 2, reference: "Measurement kit", quantity: 1, manufacturer: "Multiple", mpn: "TW-1594-MEAS", description: "Coaxial shunt, connectors, passives, and protection", unitPriceCents: 58600, sourcing: "Kit stock" },
    ],
    tiers: [
      { id: "files", name: "Design files", priceCents: 7500, summary: "Fixture, adapters, scripts, and test procedure.", features: ["Native source", "Automation scripts", "Commercial lab license"], actionLabel: "License design files" },
      { id: "bom-kit", name: "PCB + components", priceCents: 69500, summary: "Fixture boards and complete component set.", features: ["PCB and adapter set", "Complete BOM", "Coaxial hardware"], actionLabel: "Add build kit", recommended: true },
      { id: "development-kit", name: "Complete development kit", priceCents: 245000, summary: "Assembled, characterized test fixture.", features: ["Assembled fixture", "Calibration data", "Guard enclosure drawings"], actionLabel: "Request development kit" },
    ],
    visual: "graphite",
    featured: true,
  },
] as const;

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function getProductBySlug(slug: string): CatalogProduct | undefined {
  return products.find((product) => product.slug === slug);
}

export function getDesignBySlug(slug: string): MarketplaceDesign | undefined {
  return designs.find((design) => design.slug === slug);
}

export function getDesignsUsingProduct(productSlug: string): MarketplaceDesign[] {
  return designs.filter((design) => design.bom.some((line) => line.productSlug === productSlug));
}

export function getProductsForDesign(design: MarketplaceDesign): CatalogProduct[] {
  const slugs = new Set(design.bom.flatMap((line) => (line.productSlug ? [line.productSlug] : [])));
  return products.filter((product) => slugs.has(product.slug));
}

export function getBomSubtotal(design: MarketplaceDesign): number {
  return design.bom.reduce((total, line) => total + line.quantity * line.unitPriceCents, 0);
}
