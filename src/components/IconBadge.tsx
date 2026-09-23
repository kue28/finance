import type { LucideIcon } from 'lucide-react';

export type BadgeTone = 'neutral' | 'income' | 'expense' | 'accent';

/** A category/account icon in a soft rounded square. */
export default function IconBadge({ icon: Icon, tone = 'neutral', size = 40 }: {
  icon: LucideIcon; tone?: BadgeTone; size?: number;
}) {
  return (
    <span className={`icon-badge ${tone}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.9} />
    </span>
  );
}
