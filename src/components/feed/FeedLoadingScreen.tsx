import { PostCardSkeleton } from './PostCardSkeleton'

interface Props {
  visible: boolean
}

export function FeedLoadingScreen({ visible }: Props) {
  return (
    <div
      className={`fixed inset-0 z-50 bg-bg-primary overflow-hidden transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Fake header row */}
        <div className="flex items-center justify-between mb-6 animate-pulse">
          <div className="h-7 w-20 bg-navy-800 rounded-lg" />
          <div className="flex gap-2">
            <div className="w-9 h-9 rounded-lg bg-navy-800" />
            <div className="w-9 h-9 rounded-lg bg-navy-800" />
            <div className="w-9 h-9 rounded-lg bg-navy-800" />
            <div className="w-24 h-9 rounded-lg bg-navy-800" />
          </div>
        </div>
        <div className="space-y-6">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      </div>
    </div>
  )
}
