import { Link, useLocation } from 'wouter';
import { BudgetIcon, ChartIcon, HomeIcon, ListIcon, MoreIcon } from './icons';

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon },
  { to: '/transactions', label: 'Transactions', Icon: ListIcon },
  { to: '/budget', label: 'Budget', Icon: BudgetIcon },
  { to: '/reports', label: 'Reports', Icon: ChartIcon },
  { to: '/more', label: 'More', Icon: MoreIcon },
];

export default function BottomNav() {
  const [location] = useLocation();
  return (
    <nav className="bottom-nav">
      {tabs.map(({ to, label, Icon }) => {
        const active = to === '/' ? location === '/' : location.startsWith(to);
        return (
          <Link key={to} href={to} className={active ? 'tab active' : 'tab'}
            aria-current={active ? 'page' : undefined}>
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
