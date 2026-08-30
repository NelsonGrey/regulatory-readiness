import type { RouteObject } from 'react-router-dom'
import { Shell } from './components/Shell.js'
import { PacksPage } from './routes/PacksPage.js'
import { NewEntityPage } from './routes/NewEntityPage.js'
import { MatrixPage } from './routes/MatrixPage.js'
import { ReviewQueuePage } from './routes/ReviewQueuePage.js'
import { RequestsPage } from './routes/RequestsPage.js'
import { RequestDetailPage } from './routes/RequestDetailPage.js'
import { ContributorPortalPage } from './routes/ContributorPortalPage.js'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <PacksPage /> },
      { path: 'w/entities/new', element: <NewEntityPage /> },
      { path: 'w/entities/:id/matrix', element: <MatrixPage /> },
      { path: 'w/entities/:id/review', element: <ReviewQueuePage /> },
      { path: 'w/entities/:id/requests', element: <RequestsPage /> },
      { path: 'w/entities/:id/requests/:requestId', element: <RequestDetailPage /> },
    ],
  },
  // No-account contributor portal — deliberately outside the operator shell.
  { path: 'contribute/:token', element: <ContributorPortalPage /> },
]
