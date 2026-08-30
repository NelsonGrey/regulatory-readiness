import type { RouteObject } from 'react-router-dom'
import { Shell } from './components/Shell.js'
import { PacksPage } from './routes/PacksPage.js'
import { NewEntityPage } from './routes/NewEntityPage.js'
import { MatrixPage } from './routes/MatrixPage.js'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <PacksPage /> },
      { path: 'w/entities/new', element: <NewEntityPage /> },
      { path: 'w/entities/:id/matrix', element: <MatrixPage /> },
    ],
  },
]
