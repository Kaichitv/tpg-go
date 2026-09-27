/** Squelette de chargement d'une liste de passages. */
export default function BoardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Chargement des passages" className="divide-y divide-hairline">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-2.5" aria-hidden>
          <span className="h-9 w-10 animate-pulse rounded-[11px] bg-surface-press" />
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-3/5 animate-pulse rounded bg-surface-press" />
            <span className="block h-3 w-1/4 animate-pulse rounded bg-surface-hover" />
          </span>
          <span className="h-6 w-10 animate-pulse rounded bg-surface-press" />
        </div>
      ))}
    </div>
  );
}
