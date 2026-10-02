// Adds an optional "Template Task" lookup on Event Task (relationship new_epm_templatetask_eventtask),
// so a task remembers which template task it came from (reliable duplicate detection on template change).
// Deleting a template task only clears the link (RemoveLink) — it never deletes event tasks.
// Idempotent. Run from your own terminal (needs `az login` with Prod access):
//   node scripts/add-eventtask-template-link.mjs
import { execSync } from 'node:child_process';

const ORG = 'https://caribbeanarea.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;
const SOL = { 'MSCRM.SolutionUniqueName': 'CAREventPlannerManager' };
const PARENT = 'new_epm_templatetask';
const CHILD = 'new_epm_eventtask';
const RELATIONSHIP = 'new_epm_templatetask_eventtask';
const LOOKUP_SCHEMA = 'new_TemplateTaskId';
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

// 0. Where are we?
const org = await must('read organization', dv('GET', "RetrieveCurrentOrganization(AccessType=Microsoft.Dynamics.CRM.EndpointAccessType'Default')"));
log('org ', ORG, '·', org.data.Detail?.FriendlyName ?? '(unknown)');

// 1. Relationship + lookup (skip if it exists; stop if the column name is taken by something else).
const rel = await dv('GET', `RelationshipDefinitions(SchemaName='${RELATIONSHIP}')?$select=SchemaName`);
if (rel.status === 200) {
  log('skip', `${RELATIONSHIP} (exists)`);
} else {
  const col = await dv('GET', `EntityDefinitions(LogicalName='${CHILD}')/Attributes(LogicalName='${LOOKUP_SCHEMA.toLowerCase()}')?$select=LogicalName,AttributeType`);
  if (col.status === 200) {
    log('STOP', `${CHILD}.${LOOKUP_SCHEMA.toLowerCase()} already exists (${col.data.AttributeType}) without relationship ${RELATIONSHIP} — nothing was changed.`);
    process.exit(1);
  }
  await must(`add ${RELATIONSHIP}`, dv('POST', 'RelationshipDefinitions', {
    '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
    SchemaName: RELATIONSHIP,
    ReferencedEntity: PARENT,
    ReferencedAttribute: `${PARENT}id`,
    ReferencingEntity: CHILD,
    CascadeConfiguration: {
      Assign: 'NoCascade', Delete: 'RemoveLink', Merge: 'NoCascade', Reparent: 'NoCascade',
      Share: 'NoCascade', Unshare: 'NoCascade', RollupView: 'NoCascade',
    },
    Lookup: {
      '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata', AttributeType: 'Lookup', AttributeTypeName: { Value: 'LookupType' },
      SchemaName: LOOKUP_SCHEMA, DisplayName: L('Template Task'),
      Description: L('Template task this event task was created from (used to skip duplicates when the template changes).'),
      RequiredLevel: { Value: 'None', CanBeChanged: true },
    },
  }, SOL));
}

await must('publish', dv('POST', 'PublishXml', {
  ParameterXml: `<importexportxml><entities><entity>${CHILD}</entity><entity>${PARENT}</entity></entities></importexportxml>`,
}));
log('DONE');
