const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app(schedules = []) {
  const context = vm.createContext({Date, console});
  context.window = context;
  context.HD_DB = {dbGetAll: async store => store === 'scheduling' ? schedules : []};
  for (const file of ['calendar', 'scheduling', 'today']) {
    vm.runInContext(fs.readFileSync(`js/${file}.js`, 'utf8'), context);
  }
  return context;
}

test('Today agenda expands recurring plans across a year boundary', async () => {
  const c = app([
    {id:'plan', title:'Friday dinner', category:'event', assignedTo:'Both', recurrenceKind:'interval', anchorDate:'2026-01-02', intervalCount:1, intervalUnit:'weeks'},
    {id:'chore', title:'Clean kitchen', category:'chore', anchorDate:'2027-01-01', intervalCount:1, intervalUnit:'weeks'}
  ]);
  const data = {events:[{id:'trip', title:'Trip', date:'2026-12-31', endDate:'2027-01-02', assignedTo:'Kasparas'}]};
  const agenda = await c.HD_TODAY.agendaForWeek(data, '2027-01-01');
  assert.equal(c.HD_CAL.ymd(agenda.start), '2026-12-28');
  assert.equal(agenda.complete, true);
  const events = c.HD_TODAY.agendaItemsOnDate(agenda.items, '2027-01-01', 'Kasparas');
  assert.deepEqual(Array.from(events, e => e.title), ['Trip', 'Friday dinner']);
  assert.deepEqual(Array.from(c.HD_TODAY.agendaItemsOnDate(agenda.items, '2027-01-01', 'Izolda'), e => e.title), ['Friday dinner']);
});

test('agenda date and person filters keep inclusive multi-day events without task or completion duplicates', () => {
  const c = app();
  const items = [
    {id:'trip', date:'2026-09-07', endDate:'2026-09-09', assignedTo:'Both'},
    {id:'personal', date:'2026-09-09', assignedTo:'Izolda'},
    {id:'shared', date:'2026-09-09'},
    {id:'future', date:'2026-09-10'},
    {id:'water', date:'2026-09-09', type:'plant'},
    {id:'chore', date:'2026-09-09', category:'chore'},
    {id:'done', date:'2026-09-09', isCompletedRecord:true}
  ];
  assert.deepEqual(Array.from(c.HD_TODAY.agendaItemsOnDate(items,'2026-09-09','Kasparas'), e => e.id), ['trip','shared']);
  assert.deepEqual(Array.from(c.HD_TODAY.agendaItemsOnDate(items,'2026-09-09','Everyone'), e => e.id), ['trip','personal','shared']);
  assert.equal(c.HD_TODAY.agendaItemsOnDate(items,'2026-09-11').length, 0);
});

test('a failed recurring-plan read marks the agenda incomplete and keeps saved events', async () => {
  const c = app();
  c.HD_SCHEDULING.getScheduleItemsInRange = async () => { throw new Error('Read failed'); };
  const data = {events:[{id:'event', title:'Appointment', date:'2026-09-07'}]};
  const agenda = await c.HD_TODAY.agendaForWeek(data, '2026-09-07');
  assert.equal(agenda.complete, false);
  assert.equal(c.HD_TODAY.agendaItemsOnDate(agenda.items,'2026-09-07')[0].title, 'Appointment');
});
