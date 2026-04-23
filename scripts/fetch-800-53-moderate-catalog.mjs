/**
 * One-off / refresh: downloads NIST SP 800-53 Rev5 catalog + MODERATE baseline profile,
 * resolves control titles for baseline IDs, writes data/policy-catalog/nist-sp800-53-rev5-moderate.json
 */
import fs from "fs";

const PROFILE_URL =
  "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_MODERATE-baseline_profile.json";
const CATALOG_URL =
  "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json";

function collectControls(node, out = new Map()) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const x of node) collectControls(x, out);
    return out;
  }
  if (typeof node.id === "string" && typeof node.title === "string") {
    out.set(node.id.toLowerCase(), node.title);
  }
  for (const k of Object.keys(node)) collectControls(node[k], out);
  return out;
}

async function main() {
  const [profRes, catRes] = await Promise.all([fetch(PROFILE_URL), fetch(CATALOG_URL)]);
  if (!profRes.ok) throw new Error(`profile ${profRes.status}`);
  if (!catRes.ok) throw new Error(`catalog ${catRes.status}`);
  const prof = await profRes.json();
  const cat = await catRes.json();
  const titles = collectControls(cat.catalog);
  const withIds = prof.profile?.imports?.[0]?.["include-controls"]?.[0]?.["with-ids"];
  if (!Array.isArray(withIds)) throw new Error("Could not parse profile include-controls.with-ids");
  const controls = withIds.map((id) => ({
    id: String(id).toUpperCase(),
    title: titles.get(String(id).toLowerCase()) ?? "",
  }));
  const out = {
    source: PROFILE_URL,
    catalogSource: CATALOG_URL,
    count: controls.length,
    controls,
  };
  fs.mkdirSync("data/policy-catalog", { recursive: true });
  fs.writeFileSync("data/policy-catalog/nist-sp800-53-rev5-moderate.json", JSON.stringify(out, null, 2), "utf8");
  console.log("wrote", controls.length, "controls -> data/policy-catalog/nist-sp800-53-rev5-moderate.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
