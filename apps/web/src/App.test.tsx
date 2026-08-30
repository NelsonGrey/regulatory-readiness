import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App.js'

describe('App', () => {
  it('renders the product name and the limitation statement', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: /regulatory readiness engine/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/not legal certification or authority approval/i)).toBeInTheDocument()
  })

  it('renders a chip for every readiness state', () => {
    render(<App />)
    expect(screen.getByText('Evidenced')).toBeInTheDocument()
    expect(screen.getByText('Conflict')).toBeInTheDocument()
    expect(screen.getByText('Not applicable')).toBeInTheDocument()
  })
})
