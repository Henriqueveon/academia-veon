import { create } from 'zustand'

// Tracks which post IDs have already finished loading their first media,
// plus a counter of how many of the *initial cold-start* posts are ready.
// The counter is used by FeedPage to decide when to release the scroll lock.

type FeedReadyStore = {
  readyIds: Set<string>
  initialReadyCount: number
  initialBudget: number          // how many posts we wait for before unlocking (default 3)
  markReady: (postId: string, isInitial: boolean) => void
  resetInitial: (budget: number) => void
}

export const useFeedReadyStore = create<FeedReadyStore>((set, get) => ({
  readyIds: new Set(),
  initialReadyCount: 0,
  initialBudget: 0,

  markReady: (postId, isInitial) => {
    const s = get()
    if (s.readyIds.has(postId)) return
    const nextIds = new Set(s.readyIds)
    nextIds.add(postId)
    set({
      readyIds: nextIds,
      initialReadyCount: isInitial ? s.initialReadyCount + 1 : s.initialReadyCount,
    })
  },

  resetInitial: (budget) => set({ initialReadyCount: 0, initialBudget: budget }),
}))
