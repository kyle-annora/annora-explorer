import React from 'react';
const paths = {
 arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
 external: <><path d="M6 18 18 6M6 6h12v12" /></>,
 close: <path d="m6 6 12 12M6 18 18 6" />,
 plus: <path d="M12 5v14M5 12h14" />,
 chevron: <path d="m9 6 6 6-6 6" />,
 back: <path d="m14 6-6 6 6 6" />,
 parts: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9v9M4 7.5 12 12l8-4.5" /></>,
 fit: <><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" /><path d="M9 9h6v6H9z" /></>,
 play: <path d="m8 5 11 7-11 7V5Z" />,
 pause: <><path d="M8 5v14M16 5v14" /></>,
 replay: <><path d="M4 10a8 8 0 1 1 .6 6M4 4v6h6" /></>,
 explode: <><path d="m12 3 8 4-8 4-8-4 8-4Zm-8 9 8 4 8-4M4 17l8 4 8-4" /></>,
 display: <><circle cx="12" cy="12" r="8" /><path d="M12 4v16M12 4a8 8 0 0 1 0 16" /></>,
 edit: <><path d="m4 16 12-12 4 4L8 20H4v-4ZM13 7l4 4" /></>,
 document: <><path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6" /></>,
 check: <path d="m5 12 4 4L19 6" />,
 info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.1" /></>,
 eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
 settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></>,
};
export function Icon({name, ...props}) {return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.parts}</svg>;}
