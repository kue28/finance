import { Route, Router, Switch, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import BottomNav from './components/BottomNav';
import AddButton from './components/AddButton';
import UpdateBanner from './components/UpdateBanner';
import Toast from './components/Toast';
import Home from './screens/Home';
import Transactions from './screens/Transactions';
import Budget from './screens/Budget';
import Reports from './screens/Reports';
import More from './screens/More';
import { AddScreen, EditTxScreen } from './screens/TxEditor';
import AccountsList from './screens/accounts/AccountsList';
import AccountEdit from './screens/accounts/AccountEdit';
import CategoriesList from './screens/categories/CategoriesList';
import CategoryEdit from './screens/categories/CategoryEdit';
import RecurringList from './screens/recurring/RecurringList';
import RecurringEdit from './screens/recurring/RecurringEdit';

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
          <Route path="/add" component={AddScreen} />
          <Route path="/tx/:id" component={EditTxScreen} />
          <Route>
            <p className="muted">Page not found.</p>
          </Route>
        </Switch>
      </main>
      {!editing && <AddButton />}
      {!editing && <BottomNav />}
      <Toast />
    </div>
  );
}
