// READ-ONLY: reports how deleting an Event (and its Tasks / Meetings / Expenses) cascades to child rows.
// No writes, no publish. Run from your own terminal (needs `az login` with Prod access):
//   node scripts/check-event-cascades.mjs
import { execSync } from 'node:child_process';

const ORG = 'https://caribbeanarea.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;
const PARENTS = ['new_epm_event', 'new_epm_eventtask', 'new_epm_meeting', 'new_epm_expense'];
/** Parent → child tables that must be Cascade (Parental) for "delete event" to remove everything. */
const EXPECTED = [
  ['new_epm_event', 'new_epm_eventtask'],
  ['new_epm_event', 'new_epm_expense'],
  ['new_epm_event', 'new_epm_meeting'],
  ['new_epm_meeting', 'new_epm_meetingattendee'],
  ['new_epm_eventtask', 'new_epm_taskcomment'],
  ['new_epm_eventtask', 'new_epm_taskhistory'],
];
const token = execSync(`az account get-access-token --resource ${ORG} --query accessToken -o tsv`).toString().trim();
const log = (...a) => console.log(...a);

async function get(path) {
  const r = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (r.status >= 300) { log('FAIL', path, r.status, JSON.stringify(data).slice(0, 600)); process.exit(1); }
  return data;
}

const MARK = { Cascade: '✅ Cascade', RemoveLink: '⚠️  RemoveLink', Restrict: '⛔ Restrict', NoCascade: '·  NoCascade' };
const mark = (v) => MARK[v] ?? v;
const pad = (s, n) => String(s).padEnd(n);

const org = await get("RetrieveCurrentOrganization(AccessType=Microsoft.Dynamics.CRM.EndpointAccessType'Default')");
log(`Org: ${ORG} · ${org.Detail?.FriendlyName ?? '(unknown)'}\n`);

const rows = [];
for (const parent of PARENTS) {
  const data = await get(`EntityDefinitions(LogicalName='${parent}')/OneToManyRelationships?$select=SchemaName,ReferencingEntity,ReferencingAttribute,CascadeConfiguration`);
  for (const rel of data.value) rows.push({ parent, ...rel });
}

// Our tables + Notes in full; system tables only when they would block the delete (Restrict).
const relevant = rows.filter((r) => r.ReferencingEntity.startsWith('new_epm_') || r.ReferencingEntity === 'annotation' || r.CascadeConfiguration?.Delete === 'Restrict');
log(pad('Parent', 20), pad('Relationship', 44), pad('Child table', 26), pad('Lookup', 24), pad('Delete', 16), pad('Assign', 12), 'Share');
log('-'.repeat(160));
for (const r of relevant.sort((a, b) => a.parent.localeCompare(b.parent) || a.ReferencingEntity.localeCompare(b.ReferencingEntity))) {
  const c = r.CascadeConfiguration ?? {};
  log(pad(r.parent, 20), pad(r.SchemaName, 44), pad(r.ReferencingEntity, 26), pad(r.ReferencingAttribute, 24), pad(mark(c.Delete), 16), pad(c.Assign, 12), c.Share);
}

log('\nExpected (must be Cascade so deleting an event removes everything):');
let problems = 0;
for (const [parent, child] of EXPECTED) {
  const found = rows.filter((r) => r.parent === parent && r.ReferencingEntity === child);
  if (found.length === 0) { problems++; log(`  ❓ ${parent} → ${child}: no relationship found`); continue; }
  for (const r of found) {
    const d = r.CascadeConfiguration?.Delete;
    if (d !== 'Cascade') problems++;
    log(`  ${d === 'Cascade' ? '✅' : '❌'} ${parent} → ${child} (${r.SchemaName}, lookup ${r.ReferencingAttribute}): Delete = ${d}`);
  }
}
const blockers = rows.filter((r) => r.CascadeConfiguration?.Delete === 'Restrict');
for (const r of blockers) log(`  ⛔ ${r.parent} → ${r.ReferencingEntity} (${r.SchemaName}) is Restrict: deleting the parent fails while children exist`);

log(problems || blockers.length ? `\n${problems + blockers.length} problem(s) found.` : '\nAll expected relationships cascade. Notes (annotation) are deleted with their parent record.');
