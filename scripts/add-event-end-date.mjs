// Adds End Date to new_epm_event and relabels Event Date as "Start Date".
// Idempotent. Run from your own terminal (needs `az login` with Prod access):
//   node scripts/add-event-end-date.mjs
import { execSync } from 'node:child_process';

const ORG = 'https://caribbeanarea.crm.dynamics.com';
const API = `${ORG}/api/data/v9.2`;
const SOL = { 'MSCRM.SolutionUniqueName': 'CAREventPlannerManager' };
const ENTITY = 'new_epm_event';
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

// 1. End Date column (date only, same behavior as Event Date).
const exists = (await dv('GET', `EntityDefinitions(LogicalName='${ENTITY}')/Attributes(LogicalName='new_enddate')?$select=LogicalName`)).status === 200;
if (exists) log('skip', 'new_enddate (exists)');
else {
  await must('add new_enddate', dv('POST', `EntityDefinitions(LogicalName='${ENTITY}')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', AttributeType: 'DateTime', AttributeTypeName: { Value: 'DateTimeType' },
    SchemaName: 'new_EndDate', DisplayName: L('End Date'), Description: L('Last day of the event (same as the start date for one-day events).'),
    RequiredLevel: { Value: 'None', CanBeChanged: true }, Format: 'DateOnly', DateTimeBehavior: { Value: 'DateOnly' },
  }, SOL));
}

// 2. Relabel new_eventdate → "Start Date" (logical name unchanged, so no data moves).
const attrPath = `EntityDefinitions(LogicalName='${ENTITY}')/Attributes(LogicalName='new_eventdate')/Microsoft.Dynamics.CRM.DateTimeAttributeMetadata`;
const current = await must('read new_eventdate', dv('GET', attrPath));
if (current.data.DisplayName?.UserLocalizedLabel?.Label === 'Start Date') log('skip', 'relabel (already "Start Date")');
else {
  // The cast GET returns @odata.context but no @odata.type; without the type, Dataverse parses the body as the
  // base AttributeMetadata and rejects DateTime-only properties (MinSupportedValue, …).
  const { '@odata.context': _ctx, ...definition } = current.data;
  const r = await dv('PUT', `EntityDefinitions(LogicalName='${ENTITY}')/Attributes(LogicalName='new_eventdate')`,
    { ...definition, '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', DisplayName: L('Start Date') },
    { ...SOL, 'MSCRM.MergeLabels': 'true' });
  // Cosmetic (the app has its own labels) — warn and keep going so the backfill still runs.
  if (r.status >= 300) log('WARN', 'relabel new_eventdate', r.status, JSON.stringify(r.data).slice(0, 300), '— rename it in the maker portal instead');
  else log('ok  ', 'relabel new_eventdate', r.status);
}

await must('publish', dv('POST', 'PublishXml', { ParameterXml: `<importexportxml><entities><entity>${ENTITY}</entity></entities></importexportxml>` }));

// 3. Backfill: existing events become one-day events (End = Start).
const rows = await must('list events without end date',
  dv('GET', `new_epm_events?$select=new_epm_eventid,new_name,new_eventdate&$filter=new_enddate eq null and new_eventdate ne null`));
for (const ev of rows.data.value) {
  await must(`backfill "${ev.new_name}" → ${ev.new_eventdate}`, dv('PATCH', `new_epm_events(${ev.new_epm_eventid})`, { new_enddate: ev.new_eventdate }));
}
log('DONE', `${rows.data.value.length} event(s) backfilled`);
