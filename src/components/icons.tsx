// Small inline SVG icons (no icon library, keeps the bundle tiny).
import type { ReactNode } from 'react';

type P = { size?: number };

const svg = (path: ReactNode) =>
  function Icon({ size = 24 }: P) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {path}
      </svg>
    );
  };

export const HomeIcon = svg(<path d="M3 11l9-8 9 8M5 10v10h14V10" />);
export const ListIcon = svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />);
export const BudgetIcon = svg(<><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6 6" /></>);
export const ChartIcon = svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const MoreIcon = svg(<><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>);
export const PlusIcon = svg(<path d="M12 5v14M5 12h14" />);
export const ChevronLeftIcon = svg(<path d="M15 18l-6-6 6-6" />);
export const ChevronRightIcon = svg(<path d="M9 18l6-6-6-6" />);
export const ChevronUpIcon = svg(<path d="M18 15l-6-6-6 6" />);
export const ChevronDownIcon = svg(<path d="M6 9l6 6 6-6" />);
export const StarIcon = svg(<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />);
