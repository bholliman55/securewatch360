import fs from "fs";

const argv = process.argv.slice(2);
const dumpHeaders = argv.includes("--headers");
const dumpRows = argv.includes("--debug-rows");

const ss = fs.readFileSync("scripts/.csf20-unzipped/xl/sharedStrings.xml", "utf8");
const siBlocks = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1]);

function siToText(block) {
  const parts = [...block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
    m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
  );
  return parts.join("");
}

const strings = siBlocks.map(siToText);
if (dumpHeaders) {
  for (const i of [10, 11, 12, 13, 14]) {
    console.log(i, strings[i]?.slice(0, 100));
  }
  process.exit(0);
}
const sh = fs.readFileSync("scripts/.csf20-unzipped/xl/worksheets/sheet2.xml", "utf8");
const rowRe = /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
const subcat = new Map();
let row;
const debugHits = [];
while ((row = rowRe.exec(sh))) {
  const rnum = row[1];
  const body = row[2];
  const c = body.match(/<c r="C\d+"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/);
  if (!c) continue;
  const idx = +c[1];
  const text = strings[idx] || "";
  const m = text.match(/^([A-Z]{2}\.[A-Z]{2}-\d{2})\s*:/);
  if (m) {
    const title = text.split(":").slice(1).join(":").trim();
    subcat.set(m[1], title.slice(0, 400));
    if (dumpRows) debugHits.push({ row: rnum, id: m[1], idx, preview: text.slice(0, 60) });
  }
}
if (dumpRows) {
  console.log(JSON.stringify(debugHits, null, 2));
  process.exit(0);
}
const active = [...subcat.entries()].filter(([, title]) => !String(title).trim().startsWith("[Withdrawn"));
const activeMap = new Map(active);
const ids = [...activeMap.keys()].sort();
const out = {
  source: "NIST CSF 2.0 Reference Tool XLSX (subcategory column); withdrawn legacy IDs removed",
  count: ids.length,
  controls: ids.map((id) => ({ id, title: activeMap.get(id) ?? "" })),
};
fs.mkdirSync("data/policy-catalog", { recursive: true });
fs.writeFileSync("data/policy-catalog/nist-csf-2.0-core.json", JSON.stringify(out, null, 2), "utf8");
console.log("count", ids.length, "-> data/policy-catalog/nist-csf-2.0-core.json");
