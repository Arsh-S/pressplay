const statusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'PENDING',
    className: 'bg-yellow-400/15 text-yellow-400',
  },
  running: {
    label: 'REC',
    className: 'bg-indigo-400/15 text-indigo-400',
  },
  completed: {
    label: 'DONE',
    className: 'bg-green-400/15 text-green-400',
  },
  failed: {
    label: 'FAIL',
    className: 'bg-red-400/15 text-red-400',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status.toUpperCase(), className: 'bg-zinc-400/15 text-zinc-400' };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}
