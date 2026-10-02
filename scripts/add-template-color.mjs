// Adds Color (local choice) to new_epm_eventtemplate for the Calendar.
// Idempotent. Run from your own terminal (needs `az login` with Prod access):
//   node scripts/add-template-color.mjs
import { execSync } from 'node:child_process';

const ORG = 'https://caribbeanarea.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;
const SOL = { 'MSCRM.SolutionUniqueName': 'CAREventPlannerManager' };
const ENTITY = 'new_epm_eventtemplate';
const COLUMN = 'new_color';
const OPTIONS = [
  ['Teal', 100000000], ['Violet', 100000001], ['Sky', 100000002],
  ['Magenta', 100000003], ['Olive', 100000004], ['Brown', 100000005],
];
const token = execSync(`az account get-access-token --resource ${ORG} --query accessToken -o tsv`).toString().trim();

const L = (t) => ({ LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: t, LanguageCode: 1033 }] });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function dv(method, path, body, headers = {}) {
  const r = await fetch(`${API}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data };
}
async function must(label, p) {
  const r = await p;
  if (r.status >= 300) { log('FAIL', label, r.status, JSON.stringify(r.data).slice(0, 600)); process.exit(1); }
  log('ok  ', label, r.status);
  return r;
}

// 0. Show where we are before any write. (organization has no friendlyname column — the
//    environment display name comes from RetrieveCurrentOrganization.)
const org = await must('read organization',
  dv('GET', "RetrieveCurrentOrganization(AccessType=Microsoft.Dynamics.CRM.EndpointAccessType'Default')"));
log('org ', ORG, '·', org.data.Detail?.FriendlyName ?? '(unknown)');

// 1. Color column — skip when it already exists with the expected options; stop (no changes) when they differ.
const existing = await dv('GET',
  `EntityDefinitions(LogicalName='${ENTITY}')/Attributes(LogicalName='${COLUMN}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)`);
if (existing.status === 200) {
  const found = (existing.data.OptionSet?.Options ?? [])
    .map((o) => [o.Label?.UserLocalizedLabel?.Label ?? '', o.Value])
    .sort((a, b) => a[1] - b[1]);
  const same = found.length === OPTIONS.length && found.every(([label, value], i) => label === OPTIONS[i][0] && value === OPTIONS[i][1]);
  if (!same) {
    log('STOP', `${ENTITY}.${COLUMN} already exists with different options — nothing was changed.`);
    for (const [label, value] of found) log('    ', value, label);
    log('    ', 'Expected:', OPTIONS.map(([label, value]) => `${value} ${label}`).join(' · '));
    process.exit(1);
  }
  log('skip', `${COLUMN} (exists with the expected options)`);
} else if (existing.status === 404) {
  await must(`add ${COLUMN}`, dv('POST', `EntityDefinitions(LogicalName='${ENTITY}')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata', AttributeType: 'Picklist', AttributeTypeName: { Value: 'PicklistType' },
    SchemaName: 'new_Color', DisplayName: L('Color'), Description: L("Color used for this template's events in the Calendar."),
    RequiredLevel: { Value: 'None', CanBeChanged: true },
    OptionSet: { '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata', IsGlobal: false, OptionSetType: 'Picklist',
      Options: OPTIONS.map(([label, value]) => ({ Value: value, Label: L(label) })) },
  }, SOL));
} else {
  log('FAIL', `check ${COLUMN}`, existing.status, JSON.stringify(existing.data).slice(0, 600));
  process.exit(1);
}

await must('publish', dv('POST', 'PublishXml', { ParameterXml: `<importexportxml><entities><entity>${ENTITY}</entity></entities></importexportxml>` }));
log('DONE');
