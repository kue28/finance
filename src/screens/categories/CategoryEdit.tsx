import { useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import type { LucideIcon } from 'lucide-react';
import type { Category } from '../../db/types';
import { useCategories, useCategory, useSubcategories } from '../../db/hooks';
import { addCategory, move, updateCategory } from '../../db/ops';
import { nameTaken } from '../../lib/labels';
import { Loading, PageHeader, ReorderButtons } from '../../components/ui';
import AddInline from '../../components/AddInline';
import IconPicker from '../../components/IconPicker';
import { categoryIcon } from '../../lib/icons';

// Why some things can't be archived:
// - System subcategories (Mobile money fees, IMTT, Bank charges, Bad debts) are
//   used automatically by transfer fees and loan write-offs.
// - A main category must keep at least one active subcategory, because every
//   expense is filed under a subcategory.

/** Route: /more/categories/:id — edit a main category and its subcategories. */
export default function CategoryEdit({ params }: { params: { id: string } }) {
  const cat = useCategory(params.id);
  const subs = useSubcategories(params.id);
  const siblings = useCategories(cat?.kind ?? 'expense');

  if (!cat || !subs || !siblings) {
    return <><PageHeader title="Category" back="/more/categories" /><Loading /></>;
  }
  return <Editor key={cat.id} cat={cat} subs={subs} siblings={siblings.filter((c) => c.parentId === null)} />;
}

function Editor({ cat, subs, siblings }: { cat: Category; subs: Category[]; siblings: Category[] }) {
  const [, navigate] = useLocation();
  const [name, setName] = useState(cat.name);
  const [error, setError] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  // Which category's icon is being chosen (the main one or a subcategory).
  const [picking, setPicking] = useState<Category | null>(null);
  const byId = new Map([cat, ...subs].map((c) => [c.id, c]));
  const MainIcon = categoryIcon(cat, byId);

  const activeSubs = subs.filter((s) => !s.archived);
  const archivedSubs = subs.filter((s) => s.archived);
  const hasSystemSub = subs.some((s) => s.systemKey);

  async function rename() {
    if (!name.trim()) return setError('Please enter a name.');
    if (nameTaken(siblings, name, cat.id)) return setError('That category already exists.');
    await updateCategory(cat.id, { name });
    setError('');
  }

  async function toggleArchive() {
    if (!cat.archived && hasSystemSub) {
      return setError('This category holds subcategories the app uses automatically, so it can\'t be archived.');
    }
    await updateCategory(cat.id, { archived: !cat.archived });
    navigate('/more/categories');
  }

  return (
    <>
      <PageHeader title={cat.name} back="/more/categories" />
      {cat.archived && <p className="notice">This category is archived.</p>}

      <div className="form">
        <label className="field">
          <span>Icon and name</span>
          <div className="add-inline-row">
            <button type="button" className="icon-choose" onClick={() => setPicking(cat)} aria-label="Change icon">
              <MainIcon size={22} strokeWidth={1.9} />
            </button>
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn" onClick={rename} disabled={name.trim() === cat.name}>Rename</button>
          </div>
        </label>
        {error && <p className="error">{error}</p>}
      </div>

      {cat.kind === 'expense' && (
        <>
          <h2>Subcategories</h2>
          <ul className="list card flush">
            {activeSubs.map((s, i) => (
              <SubRow key={s.id} sub={s} siblings={subs} icon={categoryIcon(s, byId)} onIcon={() => setPicking(s)}
                canArchive={!s.systemKey && activeSubs.length > 1}
                reorder={<ReorderButtons first={i === 0} last={i === activeSubs.length - 1}
                  onUp={() => move('categories', activeSubs, s.id, -1)}
                  onDown={() => move('categories', activeSubs, s.id, 1)} />} />
            ))}
          </ul>
          <AddInline placeholder="New subcategory" onAdd={async (n) => {
            if (nameTaken(subs, n)) return 'That subcategory already exists.';
            await addCategory(n, 'expense', cat.id);
          }} />

          {archivedSubs.length > 0 && (
            <>
              <button className="link-btn" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Hide' : 'Show'} archived ({archivedSubs.length})
              </button>
              {showArchived && (
                <ul className="list card flush">
                  {archivedSubs.map((s) => (
                    <li key={s.id} className="row">
                      <div className="row-main"><div className="row-title muted">{s.name}</div></div>
                      <button className="btn small ghost" onClick={() => updateCategory(s.id, { archived: false })}>
                        Unarchive
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      <button className="btn block ghost" style={{ marginTop: 24 }} onClick={toggleArchive}>
        {cat.archived ? 'Unarchive category' : 'Archive category'}
      </button>
      {!cat.archived && (
        <p className="muted small">Archiving hides it when adding transactions. Past transactions keep their category.</p>
      )}

      {picking && (
        <IconPicker value={picking.icon} allowInherit={picking.parentId !== null} onClose={() => setPicking(null)}
          onPick={async (key) => { await updateCategory(picking.id, { icon: key }); setPicking(null); }} />
      )}
    </>
  );
}

/** A subcategory row; tap the name to rename it in place. */
function SubRow({ sub, siblings, canArchive, reorder, icon: Icon, onIcon }: {
  sub: Category; siblings: Category[]; canArchive: boolean; reorder: ReactNode; icon: LucideIcon; onIcon: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sub.name);
  const [error, setError] = useState('');

  async function save() {
    if (!name.trim()) return setError('Please enter a name.');
    if (nameTaken(siblings, name, sub.id)) return setError('That subcategory already exists.');
    await updateCategory(sub.id, { name });
    setEditing(false);
    setError('');
  }

  if (editing) {
    return (
      <li className="row column">
        <div className="add-inline-row">
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <button className="btn" onClick={save}>Save</button>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row-actions">
          <button className="btn small ghost" onClick={() => { setEditing(false); setName(sub.name); setError(''); }}>
            Cancel
          </button>
          {canArchive ? (
            <button className="btn small ghost" onClick={() => updateCategory(sub.id, { archived: true })}>Archive</button>
          ) : (
            <span className="muted small">
              {sub.systemKey ? 'Used automatically by the app — can be renamed, not archived.' : 'The last subcategory can\'t be archived.'}
            </span>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="row">
      <button className="icon-choose small" onClick={onIcon} aria-label={`Change icon for ${sub.name}`}>
        <Icon size={18} strokeWidth={1.9} />
      </button>
      <button className="row-main plain" onClick={() => setEditing(true)}>
        <div className="row-title">{sub.name}</div>
        {sub.systemKey && <div className="muted small">Used automatically</div>}
      </button>
      {reorder}
    </li>
  );
}
