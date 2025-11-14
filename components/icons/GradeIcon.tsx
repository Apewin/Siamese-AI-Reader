
import React from 'react';

export const GradeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m16 3-4 4-4-4" />
        <path d="m16 21-4-4-4 4" />
        <path d="M12 7.5v9" />
        <path d="M7.5 12H21" />
        <path d="M4.5 12H3" />
        <path d="m18 15 .5 1" />
        <path d="m18 9-.5-1" />
        <path d="m6 9 .5-1" />
        <path d="m6 15-.5 1" />
    </svg>
);
