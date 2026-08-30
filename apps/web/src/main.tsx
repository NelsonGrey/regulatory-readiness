import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { routes } from './router.js'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

const router = createBrowserRouter(routes, {
  future: { v7_relativeSplatPath: true },
})

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} future={{ v7_startTransition: true }} />
  </StrictMode>,
)
