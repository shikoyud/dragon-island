import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { sessionStore } from '../src/api/session'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStore.clear()
})
