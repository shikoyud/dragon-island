export type XStatus = 'denied' | 'error' | 'too_new' | 'expired'

function message(status: XStatus, minAccountAgeDays: number): string {
  switch (status) {
    case 'denied':
      return 'X sign-in was cancelled. Connect again whenever you are ready.'
    case 'error':
      return 'Something went wrong while signing in with X. Please try again.'
    case 'expired':
      return 'Your session expired. Connect X again to pick up where you left off.'
    case 'too_new':
      return `Your X account is too new to join. Accounts must be at least ${minAccountAgeDays} days old.`
  }
}

export function StepX({
  xStatus,
  refCode,
  minAccountAgeDays,
}: {
  xStatus?: XStatus | null
  refCode?: string | null
  minAccountAgeDays: number
}) {
  const href = refCode ? `/api/auth/x?ref=${encodeURIComponent(refCode)}` : '/api/auth/x'
  return (
    <div className="step">
      <h3 className="step-title">Connect your X account</h3>
      <p className="step-text">
        Sign in with X so we know who you are. We only read your handle, name and avatar. We never post for you.
      </p>
      {xStatus ? (
        <p className="notice notice-warn" role="alert">
          {message(xStatus, minAccountAgeDays)}
        </p>
      ) : null}
      <a className="btn btn-primary" href={href}>
        Connect X
      </a>
    </div>
  )
}
