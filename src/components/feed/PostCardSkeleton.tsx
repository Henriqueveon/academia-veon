export function PostCardSkeleton() {
  return (
    <div className="bg-bg-card border border-navy-800 rounded-2xl overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-navy-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-navy-800 rounded w-1/3" />
          <div className="h-2 bg-navy-800 rounded w-1/4" />
        </div>
      </div>
      <div className="aspect-[4/5] bg-navy-800" />
      <div className="px-4 pt-3 pb-2 flex items-center gap-5">
        <div className="w-6 h-6 rounded bg-navy-800" />
        <div className="w-6 h-6 rounded bg-navy-800" />
        <div className="w-6 h-6 rounded bg-navy-800" />
      </div>
      <div className="p-4 space-y-2">
        <div className="h-3 bg-navy-800 rounded w-1/4" />
        <div className="h-3 bg-navy-800 rounded w-3/4" />
      </div>
    </div>
  )
}
