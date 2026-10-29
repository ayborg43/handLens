const base = {
  className: 'icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false'
};

export const IconWarning = () => (
  <svg {...base}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

export const IconCheck = () => (
  <svg {...base}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const IconDownload = () => (
  <svg {...base}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
);

export const IconArrowLeft = () => (
  <svg {...base}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const IconArrowRight = () => (
  <svg {...base}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export const BrandMark = () => (
  <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="8" fill="#ffffff" stroke="#c3cdc9" />
    <rect x="9" y="9" width="14" height="14" rx="4" fill="#2fe38b" stroke="#08774a" strokeWidth="1.5" />
  </svg>
);

export const IconLink = () => (
  <svg {...base}>
    <path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" />
  </svg>
);

export const IconVolume = () => (
  <svg {...base}>
    <path d="M11 5 6 9H3v6h3l5 4V5ZM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

export const IconStop = () => (
  <svg {...base}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const IconExternal = () => (
  <svg {...base}>
    <path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
