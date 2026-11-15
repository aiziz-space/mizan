/* ميزان — hand-made inline SVG icons (24×24, stroke-based). */
(function (root) {
  'use strict';
  const M = (root.M = root.M || {});
  const I = {
    home: '<path d="M3.5 10.5 12 4l8.5 6.5"/><path d="M5.5 9v10.5h4.5V14h4v5.5h4.5V9"/>',
    food: '<path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M8 12v9"/><path d="M17 21V3c-2.2 1.2-3.5 3.6-3.5 7v3h3.5"/>',
    dumbbell: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
    chart: '<path d="M4 20h16"/><path d="M5 16l4.5-5 3.5 3 6-7"/><circle cx="19" cy="7" r="1.2" fill="currentColor"/>',
    more: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>',
    flame: '<path d="M12 21c-3.6 0-6.5-2.6-6.5-6.3 0-3.2 2.2-5.3 3.6-7.3.4 1.9 1.5 3 2.6 3.4C11.3 7.6 12.4 5 14.6 3c.1 3 1.6 4.8 2.8 6.4 1 1.4 1.6 2.9 1.6 5.2C19 18.4 15.9 21 12 21Z"/><path d="M12 21c-1.6 0-2.8-1.2-2.8-2.8 0-1.6 1.2-2.6 2-3.6.4 1 1 1.4 1.6 1.6.3-1.1.9-2 1.6-2.6.3 1.4 1.2 2.4 1.2 4 0 1.9-1.6 3.4-3.6 3.4Z" fill="currentColor" stroke="none" opacity=".35"/>',
    drop: '<path d="M12 3.2c3.2 4 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 2.8-6.6 6-10.6Z"/><path d="M9 14.5a3 3 0 0 0 3 3" opacity=".6"/>',
    steps: '<path d="M8.5 4.5c1.6 0 2.4 1.6 2.4 3.6s-.8 4.4-2.4 4.4S6 10.6 6 8.6s.9-4.1 2.5-4.1Z"/><path d="M7 15h3.3l-.3 2.3a1.5 1.5 0 0 1-3 0Z"/><path d="M15.5 8.5c1.6 0 2.5 1.8 2.5 3.8s-.9 4.2-2.5 4.2-2.4-2.2-2.4-4.2.8-3.8 2.4-3.8Z"/><path d="M14 18.6h3.3l-.3 1.6a1.5 1.5 0 0 1-3 0Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m4.5 12.5 4.5 4.5 10.5-11"/>',
    play: '<path d="M8 5.5v13l10.5-6.5Z" fill="currentColor"/>', pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
    next: '<path d="M7 5.5v13l8.5-6.5ZM17.5 5.5v13" />', prev: '<path d="M17 5.5v13L8.5 12ZM6.5 5.5v13"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    chevL: '<path d="m14.5 5-7 7 7 7"/>', chevR: '<path d="m9.5 5 7 7-7 7"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
    camera: '<path d="M3.5 8h4l1.6-2.5h5.8L16.5 8h4v11h-17Z"/><circle cx="12" cy="13.3" r="3.6"/>',
    scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 9.5a5 5 0 0 1 8 0"/><path d="m12 11.5 1.6-2.6"/>',
    trophy: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0Z"/><path d="M7.5 6H4.5a3 3 0 0 0 3 4.5M16.5 6h3a3 3 0 0 1-3 4.5M12 13.5V17M8.5 20h7M9.5 17h5v3h-5z"/>',
    medal: '<path d="m8 3 4 6 4-6M5.5 3H10M14 3h4.5"/><circle cx="12" cy="15" r="5.5"/><path d="m12 12.4.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3Z" fill="currentColor" stroke="none"/>',
    crown: '<path d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10Z"/><path d="M4.5 20.5h15"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8Z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    bolt: '<path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.5"/>',
    warn: '<path d="M12 3.5 2.5 20h19Z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M18.5 6.5l1.5-1.5"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
    ruler: '<path d="M3 15.5 15.5 3l5.5 5.5L8.5 21Z"/><path d="m7 11.5 2 2M10 8.5l1.5 1.5M13 5.5l2 2M5.5 14.5l1 1"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>', upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9"/><path d="M19.5 4v5h-5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor"/><circle cx="4.8" cy="12" r="1" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    egg: '<path d="M12 3c3.6 0 6.5 5.4 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.4 8.4 3 12 3Z"/>',
    walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.5-6 2.5 2.5V21M8 11.5l2.5-3.5 3.5.5 2 3.5 2.5 1M11.5 15l1.5-6.5"/>',
    gym: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 11.5V20h14v-8.5"/>'
  };
  M.icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${I[name] || I.info}</svg>`;
  M.ICONS = I;
})(typeof window !== 'undefined' ? window : globalThis);
