// scripts/generate-personas.ts
// Generates docs/PERSONAS-APPENDIX.md from the dimensions defined in docs/PERSONAS.md.
// Run: npx tsx scripts/generate-personas.ts > docs/PERSONAS-APPENDIX.md
//
// Why 1024? Two raised to the tenth — a clean power of two that demonstrates the
// dimension space exhausts well past common product team headcounts, while staying
// editable as a single markdown file. The matrix is purely for design-pressure-testing
// the board components; it is not a customer roster.

const ROLES = ["ADMIN", "MANAGER", "OWNER", "COLLAB", "OUTSIDER"] as const;
const SIZES = ["Solo", "Tiny", "Mid", "Large"] as const;
const INDUSTRIES = [
  "Software",
  "Marketing",
  "Design",
  "Consulting",
  "Legal",
  "Accounting",
  "Sales",
  "Customer Success",
  "HR",
  "Finance",
  "Operations",
  "Real Estate",
  "Healthcare",
  "Education",
  "Non-Profit",
  "Construction",
] as const;
const DEVICES = ["Desktop", "Mobile", "Tablet", "A11y"] as const;
const TENURE = ["D1", "D7", "D30", "D365"] as const;
const DEXTERITY = ["Standard", "Constrained"] as const;

const NAMES = [
  "Aarav", "Beatrix", "Cyrus", "Devansh", "Esi", "Farhan", "Gabi", "Hans",
  "Iyana", "Joon", "Karina", "Liam", "Mei", "Noah", "Ola", "Pat",
  "Quinn", "Rin", "Sven", "Tara", "Uma", "Vihaan", "Wren", "Xander",
  "Yara", "Zane", "Amara", "Bode", "Cora", "Dario", "Eira", "Finn",
  "Gita", "Hugo", "Ines", "Jules", "Kavi", "Lior", "Mira", "Nilo",
  "Oren", "Pia", "Qadir", "Rhea", "Sami", "Tomi", "Uri", "Vega",
  "Wynn", "Xola", "Yuki", "Zaid", "Anouk", "Boris", "Catalina", "Dax",
  "Ember", "Fabian", "Gracia", "Hari", "Imani", "Jorge", "Kira", "Lena",
];

interface Persona {
  id: number;
  name: string;
  role: string;
  size: string;
  industry: string;
  device: string;
  tenure: string;
  dexterity: string;
}

function generate(): Persona[] {
  const rows: Persona[] = [];
  // Cycle dimensions to hit exactly 1024 rows: 5*4*16*4*4*2 = 10,240 total slots; sample every 10th to compress.
  // To get exactly 1024 we use the full Cartesian (10,240) and select every 10th = 1024.
  let id = 0;
  for (const role of ROLES) {
    for (const size of SIZES) {
      for (const industry of INDUSTRIES) {
        for (const device of DEVICES) {
          for (const tenure of TENURE) {
            for (const dexterity of DEXTERITY) {
              if (id % 10 === 0) {
                rows.push({
                  id: rows.length + 1,
                  name: NAMES[rows.length % NAMES.length] + "-" + (Math.floor(rows.length / NAMES.length) + 1),
                  role,
                  size,
                  industry,
                  device,
                  tenure,
                  dexterity,
                });
              }
              id++;
            }
          }
        }
      }
    }
  }
  return rows;
}

function render(rows: Persona[]): string {
  const lines: string[] = [
    "# Personas — appendix (auto-generated)",
    "",
    "> **Do not edit by hand.** Regenerate via `npx tsx scripts/generate-personas.ts > docs/PERSONAS-APPENDIX.md`.",
    "> See [`PERSONAS.md`](./PERSONAS.md) for the dimensions and rationale.",
    "",
    `Total rows: **${rows.length}**`,
    "",
    "| # | Name | Role | Size | Industry | Device | Tenure | Dexterity |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const p of rows) {
    lines.push(
      `| ${p.id} | ${p.name} | ${p.role} | ${p.size} | ${p.industry} | ${p.device} | ${p.tenure} | ${p.dexterity} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

const rows = generate();
process.stdout.write(render(rows));
