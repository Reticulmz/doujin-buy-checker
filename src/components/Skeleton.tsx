export function CardSkeleton(props: { count?: number }) {
  const n = props.count ?? 3;
  return (
    <div class="space-y-3">
      {Array.from({ length: n }, () => (
        <div class="card animate-pulse">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div class="p-4 space-y-2">
      <CardSkeleton count={5} />
    </div>
  );
}
