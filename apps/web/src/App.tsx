import { useMe } from './state/me'
import { SignIn } from './wallet/SignIn'

export function App() {
  const me = useMe()
  return (
    <main style={{ padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Wyrmhaven</h1>
        <SignIn />
      </header>
      {me.data && (
        <p data-testid="resources">
          {me.data.state.gold.toLocaleString()} gold · {me.data.state.food.toLocaleString()} food · level {me.data.state.level}
        </p>
      )}
    </main>
  )
}
