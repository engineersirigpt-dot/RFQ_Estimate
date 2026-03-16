# Estimate-Packaging

ระบบประเมินราคางานประเภทกล่องบรรจุภัณฑ์ (Packaging Box Estimation System)

## Quick Start

```bash
npm install
npm run dev          # Port 3040
npm run production
```

## Architecture

```
Estimate-Packaging/
├── index.js                          # Express server entry point
├── config/
│   ├── default.json                  # Dev config (port 3040)
│   └── production.json               # Prod config
├── CLAUDE/                           # Reference documentation
│   ├── README.md                     # Detailed system overview & formulas
│   ├── pricing_calculation_flow.md   # Complete pricing formulas
│   └── machine_spec_v1.1.md          # Machine specifications
├── public/
│   ├── *.ejs                         # View templates
│   ├── js/
│   │   ├── function_estimate_calculation.js  # Core calc (8,819 lines)
│   │   ├── function_estimate_layout.js       # UPS & layout
│   │   ├── function_estimate_validate.js     # Validation (72 KB)
│   │   ├── function_estimate_processInfo.js  # Process handling (40 KB)
│   │   ├── function_estimate.js              # Main UI bridge (637 KB)
│   │   ├── function_estimate_readyFunction.js # Events & init (117 KB)
│   │   ├── function_estimate_displayData2UI.js # Render (46 KB)
│   │   ├── function_estimate_database.js     # Master data cache
│   │   ├── function_estimate_fetchData.js    # API calls
│   │   ├── prepare_data.js                   # Data transform for save
│   │   ├── data/default.js                   # Config constants
│   │   └── documentStatusManagerClass.js     # Approval workflow
│   └── css/
├── router/                           # Express routes
└── test/                             # Jest test suite
```

## Calculation Pipeline

### A. Layout Engine
1. Open Size — unfold box dimensions (12 box type formulas)
2. Tolerance — add gripper/color bar/bleed/paper edge
3. Machine Selection — auto-select based on size & colors
4. UPS — max units per sheet (test 4 orientations)

### B. Paper Usage
1. Split — units per roll width × cut-off
2. After UPS — ceil(qty / UPS)
3. Waste — add waste from all processes
4. Paper Net — final quantity in kg/tons

### C. 16 Cost Items
Paper, Plate, Proof, Print, Coating, Foil Stamp, Bossing, Special Ink, Assembly, Die-cut, Digital DC, Chip, Inspection, Corrugated, Packing, Delivery

### D. Total
subtotal = sum(C1-C16) + other_cost → markup/markdown → tax → exchange rate

## Box Types

12 types: RTE, STE, TTSLB, TTAB, DGWS, FVT, CBT, GTA, Sleeve, Pillow, SE, Custom

## Print Types

Offset (default), Flexo (corrugated only), Jet Press, Konica — each with different tolerances, waste rates, and constraints

## Authentication & Workflow

- Cookie-based JWT auth (accessToken 15min, refreshToken 7days)
- Roles: super_admin, enable_price_check, regular
- Approval: Draft → Pending → Approved / Rejected

## Related Systems

- **Estimate-Server** — Backend API (port 3010)
- **Estimate-Book** — ระบบประเมินหนังสือ
- **Estimate-Popup** — ระบบประเมินหนังสือ Popup
