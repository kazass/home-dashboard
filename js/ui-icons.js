/* Shared outline icon vocabulary. Labels remain in real HTML. */
(() => {
 const paths={
 home:'<path d="m3 10 9-8 9 8v11H3V10Z"/><path d="m9 10 5 4v7"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18"/>',
 tasks:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="m9 10 2 2 4-5m-6 10h6"/>',
 kitchen:'<path d="M5 3v7m-3-7v5a3 3 0 0 0 6 0V3M5 11v10m12-18c-4 3-4 9 0 10h3V3h-3Zm3 10v8"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 shopping:'<path d="m7 8 5-6 5 6M2 8h20l-3 13H5L2 8Zm0 5h20m-14 4h1m6 0h1"/>',
 garden:'<path d="M5 18C1 7 11 2 21 3c0 10-4 16-13 15M3 22l12-12"/>',
 search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 left:'<path d="m14 5-7 7 7 7"/>',right:'<path d="m10 5 7 7-7 7"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',check:'<path d="m4 12 5 5L20 6"/>',
 people:'<circle cx="9" cy="7" r="3"/><path d="M2 21v-4a5 5 0 0 1 10 0v4m4-17a3 3 0 0 1 0 6m1 3a5 5 0 0 1 5 5v3"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
 notes:'<path d="M15 3H4v18h16V8l-5-5Zm0 0v5h5M8 12h8m-8 4h5"/>',
 ideas:'<path d="M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0l-1 4H9l-1-4Z"/>',
 goals:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 activities:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',stats:'<path d="M4 20V10m8 10V4m8 16v-7"/>',
 music:'<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
 trip:'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M8 11v6m8-6v6"/>',
 weather:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
 about:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
 edit:'<path d="m4 16-1 5 5-1L21 7l-4-4L4 16Zm10-10 4 4"/>',
 };
 window.HD_ICONS={svg:(name,cls='')=>`<svg class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.more}</svg>`};
})();
