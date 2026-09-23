import { Link } from 'wouter';

/** The Budget | Reports switch at the top of the shared Budget tab. */
export default function BudgetReportsSwitch({ current }: { current: 'budget' | 'reports' }) {
  return (
    <div className="segmented top-switch" role="tablist">
      <Link href="/budget" role="tab" aria-selected={current === 'budget'} className={current === 'budget' ? 'seg active' : 'seg'}>
        Budget
      </Link>
      <Link href="/reports" role="tab" aria-selected={current === 'reports'} className={current === 'reports' ? 'seg active' : 'seg'}>
        Reports
      </Link>
    </div>
  );
}
