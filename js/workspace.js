/* A single registry drives navigation and the configurable widget catalogue. */
(() => {
  const features = [
    {id:'dashboard', title:'Today', description:'Your day, at a glance', primary:true},
    {id:'calendar', title:'Calendar', description:'Events, holidays and plans', primary:true},
    {id:'tasks', title:'Tasks', description:'To-dos and recurring chores', primary:true},
    {id:'kitchen', title:'Kitchen', description:'Shopping, recipes and meals', primary:true},
    {id:'more', title:'More', description:'Everything for your home', primary:true},
    {id:'garden', title:'Garden', description:'Plants, watering and care'},
    {id:'notes', title:'Notes', description:'Things to remember'},
    {id:'ideas', title:'Ideas', description:'A little inspiration for later'},
    {id:'goals', title:'Family goal', description:'Make progress together'},
    {id:'activities', title:'Activities', description:'Keep your good habits going'},
    {id:'stats', title:'Stats', description:'Completions, points and streaks'},
    {id:'decide', title:'Decide', description:'Let a little chance help'},
    {id:'music', title:'Music', description:'Your Spotify playlist'},
    {id:'about', title:'About', description:'Version history and a little game'},
    {id:'settings', title:'Settings', description:'Appearance, people and your data'},
  ];
  const widgets = [
    {id:'shopping',title:'Shopping',description:'Your list, ready to check off'},
    {id:'meals',title:'Tonight',description:'A little dinner inspiration'},
    {id:'garden',title:'Garden',description:'Plants that need a drink'},
    {id:'notes',title:'Notes',description:'Keep a note close by'},
    {id:'trip',title:'Next trip',description:'Something to look forward to'},
    {id:'weather',title:'Weather',description:'Conditions where you are'},
    {id:'goals',title:'Family goal',description:'A shared goal, a step at a time'},
    {id:'activities',title:'Activities',description:'Log your everyday habits'},
    {id:'stats',title:'Stats',description:'Your household progress'},
    {id:'music',title:'Music',description:'A soundtrack for home'},
    {id:'decide',title:'Decide',description:'A little help choosing'},
  ];
  const defaults = {daily:['shopping','meals','garden'],week:['meals','shopping','trip'],focus:['shopping']};
  const key='hd-layout';
  function read() { try { return JSON.parse(HD_STORAGE.getItem(key) || '{}'); } catch { return {}; } }
  function profile() { return window.innerWidth < 900 ? 'portrait' : 'landscape'; }
  function normalize(layout) {
    const preset = Object.keys(defaults).includes(layout?.preset) ? layout.preset : 'daily';
    const ids = new Set(widgets.map(w => w.id));
    const order = Array.isArray(layout?.widgets) ? [...new Set(layout.widgets.filter(id => ids.has(id)))] : [...defaults[preset]];
    const sizes = Object.fromEntries(order.map(id => [id, ['compact','standard','wide'].includes(layout?.sizes?.[id]) ? layout.sizes[id] : 'standard']));
    return {preset, widgets:order, sizes};
  }
  function getLayout() { return normalize(read().v3?.[profile()]); }
  function saveLayout(layout) {
    const existing = read();
    HD_STORAGE.setItem(key, JSON.stringify({...existing, v3:{...existing.v3, [profile()]:normalize(layout)}}));
  }
  window.HD_WORKSPACE = {features, widgets, defaults, getLayout, saveLayout, normalize, profile};
})();
