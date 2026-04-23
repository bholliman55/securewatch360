import fs from "fs";

const CATALOG_URL =
  "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-171/rev3/json/NIST_SP800-171_rev3_catalog.json";

function walkTitles(node, out = new Map()) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const x of node) walkTitles(x, out);
    return out;
  }
  if (typeof node.id === "string" && typeof node.title === "string") {
    out.set(node.id, node.title);
  }
  for (const k of Object.keys(node)) walkTitles(node[k], out);
  return out;
}

async function main() {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(String(res.status));
  const j = await res.json();
  const titles = walkTitles(j.catalog);
  const leafRe = /^SP_800_171_\d{2}\.\d{2}\.\d{2}$/;
  const controls = [...titles.entries()]
    .filter(([id]) => leafRe.test(id))
    .map(([id, title]) => ({
      id: id.replace(/^SP_800_171_/, ""),
      title,
    }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const out = {
    source: CATALOG_URL,
    count: controls.length,
    controls,
  };
  fs.mkdirSync("data/policy-catalog", { recursive: true });
  fs.writeFileSync("data/policy-catalog/nist-sp800-171-rev3-requirements.json", JSON.stringify(out, null, 2), "utf8");
  console.log("wrote", controls.length, "-> data/policy-catalog/nist-sp800-171-rev3-requirements.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
