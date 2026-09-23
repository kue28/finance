import { Link } from 'wouter';
import { PlusIcon } from './icons';

// The always-visible "Add" button, sitting above the bottom nav on the right
// where a thumb naturally rests.
export default function AddButton() {
  return (
    <Link href="/add" className="fab" aria-label="Add transaction">
      <PlusIcon size={30} />
    </Link>
  );
}
