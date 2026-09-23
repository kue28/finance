import { Route, Router, Switch, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import BottomNav from './components/BottomNav';
import AddButton from './components/AddButton';
import UpdateBanner from './components/UpdateBanner';
import Home from './screens/Home';
import Transactions from './screens/Transactions';
import Budget from './screens/Budget';
import Reports from './screens/Reports';
import More from './screens/More';
import Add from './screens/Add';

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
  const onAdd = location.startsWith('/add');

  return (
    <div className="app">
      <UpdateBanner />
      <main className="screen">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/budget" component={Budget} />
          <Route path="/reports" component={Reports} />
          <Route path="/more" component={More} />
          <Route path="/add" component={Add} />
          <Route>
            <p className="muted">Page not found.</p>
          </Route>
        </Switch>
      </main>
      {!onAdd && <AddButton />}
      <BottomNav />
    </div>
  );
}
