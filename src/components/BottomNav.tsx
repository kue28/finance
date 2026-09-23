import { Link, useLocation } from 'wouter';
import { ChartPie, Ellipsis, House, List, Plus, type LucideIcon } from 'lucide-react';

const left: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/', label: 'Home', Icon: House },
  { to: '/transactions', label: 'Activity', Icon: List },
];
const right: { to: string; label: string; Icon: LucideIcon }[] = [
  // Budget and Reports share a tab (switch at the top of the screen).
  { to: '/budget', label: 'Budget', Icon: ChartPie },
  { to: '/more', label: 'More', Icon: Ellipsis },
];

/**
 * Bottom navigation with the Add button in the middle, raised above the bar.
 * Sitting in the bar (instead of floating over the page) means it never
 * covers amounts in lists, and it's still right under your thumb.
 */
export default function BottomNav() {
  const [location] = useLocation();
  const tab = ({ to, label, Icon }: { to: string; label: string; Icon: LucideIcon }) => {
    const active = to === '/' ? location === '/'
      : to === '/budget' ? location.startsWith('/budget') || location.startsWith('/reports')
      : location.startsWith(to);
    return (
      <Link key={to} href={to} className={active ? 'tab active' : 'tab'} aria-current={active ? 'page' : undefined}>
        <Icon size={22} strokeWidth={active ? 2.3 : 1.9} />
        <span>{label}</span>
      </Link>
    );
  };
  return (
    <nav className="bottom-nav">
      {left.map(tab)}
      <div className="tab-add-slot">
        <Link href="/add" className="tab-add" aria-label="Add transaction">
          <Plus size={30} strokeWidth={2.4} />
        </Link>
      </div>
      {right.map(tab)}
    </nav>
  );
}
