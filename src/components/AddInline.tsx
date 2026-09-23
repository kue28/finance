import { useState, type FormEvent } from 'react';

/** A text field plus "Add" button for quickly adding a named item. */
export default function AddInline({ placeholder, onAdd }: {
  placeholder: string;
  /** Return an error message to show, or nothing on success. */
  onAdd: (name: string) => Promise<string | void>;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const err = await onAdd(name);
    if (err) setError(err);
    else { setName(''); setError(''); }
  }

  return (
    <form className="add-inline" onSubmit={submit}>
      <div className="add-inline-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} />
        <button className="btn" type="submit" disabled={!name.trim()}>Add</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
