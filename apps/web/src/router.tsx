import type { RouteObject } from 'react-router-dom'
import { Shell } from './components/Shell.js'
import { PacksPage } from './routes/PacksPage.js'
import { NewEntityPage } from './routes/NewEntityPage.js'
import { MatrixPage } from './routes/MatrixPage.js'
import { ReviewQueuePage } from './routes/ReviewQueuePage.js'
import { RequestsPage } from './routes/RequestsPage.js'
import { RequestDetailPage } from './routes/RequestDetailPage.js'
import { SnapshotsPage } from './routes/SnapshotsPage.js'
import { NotificationsPage } from './routes/NotificationsPage.js'
import { DocumentsPage } from './routes/DocumentsPage.js'
import { ExtractionReviewPage } from './routes/ExtractionReviewPage.js'
import { PackImpactPage } from './routes/PackImpactPage.js'
import { ContributorPortalPage } from './routes/ContributorPortalPage.js'
import { DeletionPage } from './routes/DeletionPage.js'
import { MembersPage } from './routes/MembersPage.js'
import { JoinPage } from './routes/JoinPage.js'
import { BillingPage } from './routes/BillingPage.js'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <PacksPage /> },
      { path: 'w/entities/new', element: <NewEntityPage /> },
      { path: 'w/packs/:packKey/impact', element: <PackImpactPage /> },
      { path: 'w/entities/:id/matrix', element: <MatrixPage /> },
      { path: 'w/entities/:id/review', element: <ReviewQueuePage /> },
      { path: 'w/entities/:id/requests', element: <RequestsPage /> },
      { path: 'w/entities/:id/requests/:requestId', element: <RequestDetailPage /> },
      { path: 'w/entities/:id/snapshots', element: <SnapshotsPage /> },
      { path: 'w/entities/:id/documents', element: <DocumentsPage /> },
      {
        path: 'w/entities/:id/documents/:documentId/extractions',
        element: <ExtractionReviewPage />,
      },
      { path: 'w/notifications', element: <NotificationsPage /> },
      { path: 'w/settings/members', element: <MembersPage /> },
      { path: 'w/settings/billing', element: <BillingPage /> },
      { path: 'w/settings/deletion', element: <DeletionPage /> },
    ],
  },
  // Accept a workspace invite — needs a signed-in person but not a workspace yet.
  { path: 'join/:token', element: <JoinPage /> },
  // No-account contributor portal — deliberately outside the operator shell.
  { path: 'contribute/:token', element: <ContributorPortalPage /> },
]
