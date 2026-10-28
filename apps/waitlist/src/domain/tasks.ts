export const TASKS = ['follow', 'like', 'repost', 'comment'] as const
export type Task = (typeof TASKS)[number]

export const CONFIRM_DELAY_MS = 15_000

export function canConfirm(openedAt: Date | null, now: Date): 'ok' | 'TASK_NOT_OPENED' | 'TOO_EARLY' {
  if (!openedAt) return 'TASK_NOT_OPENED'
  return now.getTime() - openedAt.getTime() >= CONFIRM_DELAY_MS ? 'ok' : 'TOO_EARLY'
}

export function taskIntentUrl(task: Task, cfg: { handle: string; postId: string }): string {
  const handle = encodeURIComponent(cfg.handle)
  const id = encodeURIComponent(cfg.postId)
  switch (task) {
    case 'follow':
      return `https://x.com/intent/follow?screen_name=${handle}`
    case 'like':
      return `https://x.com/intent/like?tweet_id=${id}`
    case 'repost':
      return `https://x.com/intent/retweet?tweet_id=${id}`
    case 'comment':
      return `https://x.com/intent/post?in_reply_to=${id}`
  }
}
