import { cn } from '@/lib/utils';
import { ROLE_LABELS, type MemberRole } from '@/lib/types';

const styles: Record<MemberRole, string> = {
  admin: 'bg-forest-tint text-forest border-forest/30',
  collaboratore: 'bg-amber-50 text-amber-700 border-amber-200',
  visualizzatore: 'bg-bg-soft text-ink-soft border-line',
};

export function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
        styles[role],
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
