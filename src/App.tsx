import { lazy, Suspense } from 'react';
import { Route, Router, Switch, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import BottomNav from './components/BottomNav';
import AddButton from './components/AddButton';
import UpdateBanner from './components/UpdateBanner';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { Loading } from './components/ui';
// Everyday screens are in the main bundle so they open instantly.
import Home from './screens/Home';
import Transactions from './screens/Transactions';
import Budget from './screens/Budget';
import More from './screens/More';
import { AddScreen, EditTxScreen } from './screens/TxEditor';

// Less-used screens load on demand, so the app starts faster on slow phones.
// (The service worker still stores them, so they work offline.)
const Reports = lazy(() => import('./screens/Reports'));
const AccountsList = lazy(() => import('./screens/accounts/AccountsList'));
const AccountEdit = lazy(() => import('./screens/accounts/AccountEdit'));
const CategoriesList = lazy(() => import('./screens/categories/CategoriesList'));
const CategoryEdit = lazy(() => import('./screens/categories/CategoryEdit'));
const RecurringList = lazy(() => import('./screens/recurring/RecurringList'));
const RecurringEdit = lazy(() => import('./screens/recurring/RecurringEdit'));
const GoalsList = lazy(() => import('./screens/goals/GoalsList'));
const GoalDetail = lazy(() => import('./screens/goals/GoalDetail'));
const GoalEdit = lazy(() => import('./screens/goals/GoalEdit'));
const LoansList = lazy(() => import('./screens/loans/LoansList'));
const LoanDetail = lazy(() => import('./screens/loans/LoanDetail'));
const LoanEdit = lazy(() => import('./screens/loans/LoanEdit'));
const BackupScreen = lazy(() => import('./screens/BackupScreen'));

// Hash-based routing (#/budget) so a refresh on any screen works on static
// hosts like GitHub Pages, which have no server-side route rewriting.
export default function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell />
    </Router>
  );
}

function Shell() {
  const [location] = useLocation();
  // The add/edit screen uses the full height for the keypad, so no nav there.
  const editing = location === '/add' || location.startsWith('/tx/');

  return (
    <div className="app">
      <UpdateBanner />
      <main className={editing ? 'screen editing' : 'screen'}>
        <ErrorBoundary key={location}>
          <Suspense fallback={<Loading />}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/transactions" component={Transactions} />
              <Route path="/budget" component={Budget} />
              <Route path="/reports" component={Reports} />
              <Route path="/more" component={More} />
              <Route path="/more/accounts" component={AccountsList} />
              <Route path="/more/accounts/:id" component={AccountEdit} />
              <Route path="/more/categories" component={CategoriesList} />
              <Route path="/more/categories/:id" component={CategoryEdit} />
              <Route path="/more/recurring" component={RecurringList} />
              <Route path="/more/recurring/:id" component={RecurringEdit} />
              <Route path="/more/goals" component={GoalsList} />
              <Route path="/more/goals/new" component={GoalEdit} />
              <Route path="/more/goals/:id/edit" component={GoalEdit} />
              <Route path="/more/goals/:id" component={GoalDetail} />
              <Route path="/more/loans" component={LoansList} />
              <Route path="/more/loans/new" component={LoanEdit} />
              <Route path="/more/loans/:id/edit" component={LoanEdit} />
              <Route path="/more/loans/:id" component={LoanDetail} />
              <Route path="/more/backup" component={BackupScreen} />
              <Route path="/add" component={AddScreen} />
              <Route path="/tx/:id" component={EditTxScreen} />
              <Route>
                <p className="muted">Page not found.</p>
              </Route>
            </Switch>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!editing && <AddButton />}
      {!editing && <BottomNav />}
      <Toast />
    </div>
  );
}
