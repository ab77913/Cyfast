import React, { Suspense, Fragment, lazy } from 'react';
import { Routes, Navigate, Route } from 'react-router-dom';

// project import
import Loader from './components/Loader/Loader';
import AdminLayout from './layouts/AdminLayout';

import GuestGuard from './components/Auth/GuestGuard';
import AuthGuard from './components/Auth/AuthGuard';

//import { BASE_URL } from './config/constant';

// ==============================|| ROUTES ||============================== //

const renderRoutes = (routes = []) => (
  <Suspense fallback={<Loader />}>
    <Routes>
      {routes.map((route, i) => {
        const Guard = route.guard || Fragment;
        const Layout = route.layout || Fragment;
        const Element = route.element;

        return (
          <Route
            key={i}
            path={route.path}
            exact={route.exact}
            element={
              <Guard>
                <Layout>{route.routes ? renderRoutes(route.routes) : <Element props={true} />}</Layout>
              </Guard>
            }
          />
        );
      })}
    </Routes>
  </Suspense>
);

export const routes = [
  // Guest routes (Welcome, Login pages)
  {
    exact: 'true',
    guard: GuestGuard,
    path: '/',
    element: lazy(() => import('./views/auth/WelcomeScreen/WelcomeScreen'))
  },
  {
    exact: 'true',
    guard: GuestGuard,
    path: '/login',
    element: lazy(() => import('./views/auth/signin/SignIn1'))
  },
  {
    exact: 'true',
    guard: GuestGuard,
    path: '/reset-password',
    element: lazy(() => import('./views/auth/reset-password/ResetPassword1'))
  },
  {
    exact: 'true',
    path: '/404',
    element: lazy(() => import('./views/errors/NotFound404'))
  },
  {
    exact: 'true',
    path: '/maintenance/coming-soon',
    element: lazy(() => import('./views/maintenance/ComingSoon'))
  },
  {
    exact: 'true',
    path: '/maintenance/error',
    element: lazy(() => import('./views/maintenance/Error'))
  },
  {
    exact: 'true',
    path: '/maintenance/offline-ui',
    element: lazy(() => import('./views/maintenance/OfflineUI'))
  },
  {
    exact: 'true',
    path: '/auth/change-password',
    element: lazy(() => import('./views/auth/ChangePassword'))
  },
  {
    exact: 'true',
    path: '/auth/profile-settings',
    element: lazy(() => import('./views/auth/ProfileSettings'))
  },
  {
    exact: 'true',
    path: '/auth/tabs-auth',
    element: lazy(() => import('./views/auth/TabsAuth'))
  },
  {
    exact: 'true',
    path: '/auth/signin-2',
    element: lazy(() => import('./views/auth/signin/SignIn2'))
  },
  {
    path: '*',
    layout: AdminLayout,
    guard: AuthGuard,
    routes: [
      //to always redirect to /projects after login
      {
        path: '/',
        element: () => <Navigate to="/projects" replace />
      },
      {
        exact: 'true',
        path: '/projects',
        element: lazy(() => import('./views/projects/List'))
      },
      {
        exact: 'true',
        path: '/projects/dashboard',
        element: lazy(() => import('./views/projects/Dashboard'))
      },
      {
        exact: 'true',
        path: '/projects/details',
        element: lazy(() => import('./views/projects/Details'))
      },
      {
        exact: 'true',
        path: '/projects/orchestrations',
        element: lazy(() => import('./views/projects/orchestrations/List'))
      },
      {
        exact: 'true',
        path: '/projects/orchestrations/details/:orchestrationId',
        element: lazy(() => import('./views/projects/orchestrations/Details'))
      },
      {
        exact: 'true',
        path: '/projects/testcases',
        element: lazy(() => import('./views/projects/test-cases/List'))
      },
      {
        exact: 'true',
        path: '/projects/requirements',
        element: lazy(() => import('./views/projects/requirements/List'))
      },
      {
        exact: 'true',
        path: '/projects/test-scenarios',
        element: lazy(() => import('./views/projects/test-scenarios/List'))
      },
      {
        exact: 'true',
        path: '/projects/documents',
        element: lazy(() => import('./views/projects/documents/List'))
      },
      {
        exact: 'true',
        path: '/projects/risks',
        element: lazy(() => import('./views/projects/risks/List'))
      },
      {
        exact: 'true',
        path: '/projects/defects',
        element: lazy(() => import('./views/projects/defects/List'))
      },
      {
        exact: 'true',
        path: '/projects/traceability',
        element: lazy(() => import('./views/projects/traceability/List'))
      },
      {
        exact: 'true',
        path: '/projects/execution/history',
        element: lazy(() => import('./views/projects/execution/ExecutionHistory'))
      },
      {
        exact: 'true',
        path: '/projects/execution/analysis',
        element: lazy(() => import('./views/projects/execution/ExecutionAnalysis'))
      },
      {
        exact: 'true',
        path: '/projects/execution/scheduled',
        element: lazy(() => import('./views/projects/execution/ScheduleCalendar'))
      },
      {
        exact: 'true',
        path: '/projects/test-recorder',
        element: lazy(() => import('./views/projects/test-recorder'))
      },
      {
        exact: 'true',
        path: '/report-customization',
        element: lazy(() => import('./views/custom-reports/List'))
      },
      {
        exact: 'true',
        path: '/test-agents',
        element: lazy(() => import('./views/test-agents/List'))
      },
      ...(import.meta.env.VITE_WINDOWS_AUTOMATION_ENABLED === 'true'
        ? [
            {
              exact: 'true',
              path: '/resources/windows-nodes',
              element: lazy(() => import('./views/windows-nodes/List'))
            },
            {
              exact: 'true',
              path: '/resources/windows-nodes/:id',
              element: lazy(() => import('./views/windows-nodes/Detail'))
            }
          ]
        : []),
      {
        exact: 'true',
        path: '/admin/users',
        element: lazy(() => import('./views/admin/Users'))
      },
      {
        exact: 'true',
        path: '/admin/roles',
        element: lazy(() => import('./views/admin/Roles'))
      },
      {
        exact: 'true',
        path: '/admin/permissions',
        element: lazy(() => import('./views/admin/Permissions'))
      },
      {
        exact: 'true',
        path: '/user/profile',
        element: lazy(() => import('./views/user/Profile'))
      }
    ]
  }
];
//     {
//       exact: 'true',
//       path: '/app/dashboard/sales',
//       element: lazy(() => import('./views/dashboard/DashSales'))
//     },
//     {
//       exact: 'true',
//       path: '/app/widgets/widget-statistic',
//       element: lazy(() => import('./views/widgets/WidgetStatistic'))
//     },
//     {
//       exact: 'true',
//       path: '/app/widgets/widget-data',
//       element: lazy(() => import('./views/widgets/WidgetData'))
//     },
//     {
//       exact: 'true',
//       path: '/app/widgets/widget-chart',
//       element: lazy(() => import('./views/widgets/WidgetChart'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/vertical/static',
//       element: lazy(() => import('./views/page-layouts/vertical/Static'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/vertical/fixed',
//       element: lazy(() => import('./views/page-layouts/vertical/Fixed'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/vertical/nav-fixed',
//       element: lazy(() => import('./views/page-layouts/vertical/NavFixed'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/vertical/collapse-menu',
//       element: lazy(() => import('./views/page-layouts/vertical/CollapseMenu'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/vertical/v-rtl',
//       element: lazy(() => import('./views/page-layouts/vertical/RTLLayout'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/horizontal',
//       element: lazy(() => import('./views/page-layouts/horizontal/Static'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/horizontal-v2',
//       element: lazy(() => import('./views/page-layouts/horizontal/Static-v2'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/horizontal-rtl',
//       element: lazy(() => import('./views/page-layouts/horizontal/RTLLayout'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/box',
//       element: lazy(() => import('./views/page-layouts/extra-layouts/Box'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/light',
//       element: lazy(() => import('./views/page-layouts/extra-layouts/Light'))
//     },
//     {
//       exact: 'true',
//       path: '/layout/dark',
//       element: lazy(() => import('./views/page-layouts/extra-layouts/Dark'))
//     },
//     {
//       exact: 'true',
//       path: '/users/user-profile',
//       element: lazy(() => import('./views/users/UserProfile'))
//     },
//     {
//       exact: 'true',
//       path: '/users/user-cards',
//       element: lazy(() => import('./views/users/UserCard'))
//     },
//     {
//       exact: 'true',
//       path: '/users/user-list',
//       element: lazy(() => import('./views/users/UserList'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/alert',
//       element: lazy(() => import('./views/ui-elements/basic/BasicAlert'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/button',
//       element: lazy(() => import('./views/ui-elements/basic/BasicButton'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/badges',
//       element: lazy(() => import('./views/ui-elements/basic/BasicBadges'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/breadcrumb-pagination',
//       element: lazy(() => import('./views/ui-elements/basic/BasicBreadcrumbPagination'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/cards',
//       element: lazy(() => import('./views/ui-elements/basic/BasicCards'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/collapse',
//       element: lazy(() => import('./views/ui-elements/basic/BasicCollapse'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/carousel',
//       element: lazy(() => import('./views/ui-elements/basic/BasicCarousels'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/grid-system',
//       element: lazy(() => import('./views/ui-elements/basic/BasicGridSystem'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/progress',
//       element: lazy(() => import('./views/ui-elements/basic/BasicProgress'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/modal',
//       element: lazy(() => import('./views/ui-elements/basic/BasicModals'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/spinner',
//       element: lazy(() => import('./views/ui-elements/basic/BasicSpinner'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/tabs-pills',
//       element: lazy(() => import('./views/ui-elements/basic/BasicTabsPills'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/typography',
//       element: lazy(() => import('./views/ui-elements/basic/BasicTypography'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/tooltip-popovers',
//       element: lazy(() => import('./views/ui-elements/basic/BasicTooltipsPopovers'))
//     },
//     {
//       exact: 'true',
//       path: '/basic/other',
//       element: lazy(() => import('./views/ui-elements/basic/BasicOther'))
//     },
//     {
//       exact: 'true',
//       path: '/hospital/hosp-dashboard',
//       element: lazy(() => import('./views/panels/hospital/Dashboard'))
//     },
//     {
//       exact: 'true',
//       path: '/hospital/hosp-department',
//       element: lazy(() => import('./views/panels/hospital/Department'))
//     },
//     {
//       exact: 'true',
//       path: '/hospital/hosp-doctor',
//       element: lazy(() => import('./views/panels/hospital/Doctor'))
//     },
//     {
//       exact: 'true',
//       path: '/hospital/hosp-patient',
//       element: lazy(() => import('./views/panels/hospital/Patient'))
//     },
//     {
//       exact: 'true',
//       path: '/hospital/hosp-nurse',
//       element: lazy(() => import('./views/panels/hospital/Nurse'))
//     },
//     {
//       exact: 'true',
//       path: '/hospital/hosp-pharmacist',
//       element: lazy(() => import('./views/panels/hospital/Pharmacist'))
//     },
//     {
//       exact: 'true',
//       path: '/hospital/hosp-laboratory',
//       element: lazy(() => import('./views/panels/hospital/Laboratory'))
//     },
//     {
//       exact: 'true',
//       path: '/helpdesk/hd-dashboard',
//       element: lazy(() => import('./views/panels/helpdesk/Dashboard'))
//     },
//     {
//       exact: 'true',
//       path: '/helpdesk/hd-ticket-create',
//       element: lazy(() => import('./views/panels/helpdesk/CreateTicket'))
//     },
//     {
//       exact: 'true',
//       path: '/helpdesk/hd-ticket-list',
//       element: lazy(() => import('./views/panels/helpdesk/TicketList'))
//     },
//     {
//       exact: 'true',
//       path: '/helpdesk/hd-ticket-details',
//       element: lazy(() => import('./views/panels/helpdesk/TicketDetails'))
//     },
//     {
//       exact: 'true',
//       path: '/helpdesk/hd-customer-list',
//       element: lazy(() => import('./views/panels/helpdesk/Customer'))
//     },
//     {
//       exact: 'true',
//       path: '/project-crm/pc-dashboard',
//       element: lazy(() => import('./views/panels/project-crm/Dashboard'))
//     },
//     {
//       exact: 'true',
//       path: '/project-crm/pc-customers',
//       element: lazy(() => import('./views/panels/project-crm/Customers'))
//     },
//     {
//       exact: 'true',
//       path: '/project-crm/pc-project',
//       element: lazy(() => import('./views/panels/project-crm/Project'))
//     },
//     {
//       exact: 'true',
//       path: '/project-crm/pc-task',
//       element: lazy(() => import('./views/panels/project-crm/Task'))
//     },
//     {
//       exact: 'true',
//       path: '/membership/mshp-dashboard',
//       element: lazy(() => import('./views/panels/membership/Dashboard'))
//     },
//     {
//       exact: 'true',
//       path: '/membership/mshp-email',
//       element: lazy(() => import('./views/panels/membership/Email'))
//     },
//     {
//       exact: 'true',
//       path: '/membership/mshp-country',
//       element: lazy(() => import('./views/panels/membership/Country'))
//     },
//     {
//       exact: 'true',
//       path: '/membership/mshp-coupons',
//       element: lazy(() => import('./views/panels/membership/Coupons'))
//     },
//     {
//       exact: 'true',
//       path: '/membership/mshp-newsletter',
//       element: lazy(() => import('./views/panels/membership/Newsletter'))
//     },
//     {
//       exact: 'true',
//       path: '/membership/mshp-user',
//       element: lazy(() => import('./views/panels/membership/User'))
//     },
//     {
//       exact: 'true',
//       path: '/membership/mshp-membership',
//       element: lazy(() => import('./views/panels/membership/Membership'))
//     },
//     {
//       exact: 'true',
//       path: '/school/sch-dashboard',
//       element: lazy(() => import('./views/panels/school/Dashboard'))
//     },
//     {
//       exact: 'true',
//       path: '/school/sch-student',
//       element: lazy(() => import('./views/panels/school/Student'))
//     },
//     {
//       exact: 'true',
//       path: '/school/sch-parents',
//       element: lazy(() => import('./views/panels/school/Parents'))
//     },
//     {
//       exact: 'true',
//       path: '/school/sch-teacher',
//       element: lazy(() => import('./views/panels/school/Teacher'))
//     },
//     {
//       exact: 'true',
//       path: '/sis/sis-dashboard',
//       element: lazy(() => import('./views/panels/sis/Dashboard'))
//     },
//     {
//       exact: 'true',
//       path: '/sis/sis-leave',
//       element: lazy(() => import('./views/panels/sis/Leave'))
//     },
//     {
//       exact: 'true',
//       path: '/sis/sis-evaluation',
//       element: lazy(() => import('./views/panels/sis/Evaluation'))
//     },
//     {
//       exact: 'true',
//       path: '/sis/sis-event',
//       element: lazy(() => import('./views/panels/sis/Event'))
//     },
//     {
//       exact: 'true',
//       path: '/sis/sis-circular',
//       element: lazy(() => import('./views/panels/sis/Circular'))
//     },
//     {
//       exact: 'true',
//       path: '/sis/sis-course',
//       element: lazy(() => import('./views/panels/sis/Course'))
//     },
//     {
//       exact: 'true',
//       path: '/crypto/cp-dashboard',
//       element: lazy(() => import('./views/panels/crypto/Dashboard'))
//     },
//     {
//       exact: 'true',
//       path: '/crypto/cp-exchange',
//       element: lazy(() => import('./views/panels/crypto/Exchange'))
//     },
//     {
//       exact: 'true',
//       path: '/crypto/cp-wallet',
//       element: lazy(() => import('./views/panels/crypto/Wallet'))
//     },
//     {
//       exact: 'true',
//       path: '/crypto/cp-transactions',
//       element: lazy(() => import('./views/panels/crypto/Transaction'))
//     },
//     {
//       exact: 'true',
//       path: '/crypto/cp-history',
//       element: lazy(() => import('./views/panels/crypto/History'))
//     },
//     {
//       exact: 'true',
//       path: '/crypto/cp-trading',
//       element: lazy(() => import('./views/panels/crypto/Trading'))
//     },
//     {
//       exact: 'true',
//       path: '/crypto/cp-coin',
//       element: lazy(() => import('./views/panels/crypto/InitialCoin'))
//     },
//     {
//       exact: 'true',
//       path: '/crypto/cp-ico',
//       element: lazy(() => import('./views/panels/crypto/IcoListing'))
//     },
//     {
//       exact: 'true',
//       path: '/ecommerce/ecomm-product-list',
//       element: lazy(() => import('./views/panels/ecommerce/Product'))
//     },
//     {
//       exact: 'true',
//       path: '/ecommerce/ecomm-product-details',
//       element: lazy(() => import('./views/panels/ecommerce/ProductDetails'))
//     },
//     {
//       exact: 'true',
//       path: '/ecommerce/ecomm-order',
//       element: lazy(() => import('./views/panels/ecommerce/Order'))
//     },
//     {
//       exact: 'true',
//       path: '/ecommerce/ecomm-checkout',
//       element: lazy(() => import('./views/panels/ecommerce/Checkout'))
//     },
//     {
//       exact: 'true',
//       path: '/ecommerce/ecomm-cart',
//       element: lazy(() => import('./views/panels/ecommerce/Cart'))
//     },
//     {
//       exact: 'true',
//       path: '/ecommerce/ecomm-customer',
//       element: lazy(() => import('./views/panels/ecommerce/Customers'))
//     },
//     {
//       exact: 'true',
//       path: '/ecommerce/ecomm-seller',
//       element: lazy(() => import('./views/panels/ecommerce/Sellers'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/sweet-alert',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceAlert'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/datepicker',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceDatepicker'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/task-board',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceTaskBoard'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/light-box',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceLightBox'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/adv-modal',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceModal'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/notification',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceNotification'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/nestable',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceNestable'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/p-notify',
//       element: lazy(() => import('./views/ui-elements/advance/AdvancePNotify'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/rating',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceRating'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/range-slider',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceRangeSlider'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/slider',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceSlider'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/syntax-highlighter',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceSyntaxHighlighter'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/tour',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceTour'))
//     },
//     {
//       exact: 'true',
//       path: '/advance/tree-view',
//       element: lazy(() => import('./views/ui-elements/advance/AdvanceTree'))
//     },
//     {
//       exact: 'true',
//       path: '/forms/form-basic',
//       element: lazy(() => import('./views/forms/FormsElements'))
//     },
//     {
//       exact: 'true',
//       path: '/forms/form-advance',
//       element: lazy(() => import('./views/forms/FormsAdvance'))
//     },
//     {
//       exact: 'true',
//       path: '/forms/form-validation',
//       element: lazy(() => import('./views/forms/FormsValidation'))
//     },
//     {
//       exact: 'true',
//       path: '/forms/form-masking',
//       element: lazy(() => import('./views/forms/FormsMasking'))
//     },
//     {
//       exact: 'true',
//       path: '/forms/form-wizard',
//       element: lazy(() => import('./views/forms/FormsWizard'))
//     },
//     {
//       exact: 'true',
//       path: '/forms/form-picker',
//       element: lazy(() => import('./views/forms/FormsPicker'))
//     },
//     {
//       exact: 'true',
//       path: '/forms/form-select',
//       element: lazy(() => import('./views/forms/FormsSelect'))
//     },
//     {
//       exact: 'true',
//       path: '/tables/bootstrap',
//       element: lazy(() => import('./views/tables/BootstrapTable'))
//     },
//     {
//       exact: 'true',
//       path: '/table/datatable/tbl-basic',
//       element: lazy(() => import('./views/tables/react-table/Basic'))
//     },
//     {
//       exact: 'true',
//       path: '/table/datatable/tbl-footer',
//       element: lazy(() => import('./views/tables/react-table/Footers'))
//     },
//     {
//       exact: 'true',
//       path: '/table/datatable/tbl-sorting',
//       element: lazy(() => import('./views/tables/react-table/Sorting'))
//     },
//     {
//       exact: 'true',
//       path: '/table/datatable/tbl-filtering',
//       element: lazy(() => import('./views/tables/react-table/Filtering'))
//     },
//     {
//       exact: 'true',
//       path: '/table/datatable/tbl-grouping',
//       element: lazy(() => import('./views/tables/react-table/Grouping'))
//     },
//     {
//       exact: 'true',
//       path: '/table/datatable/tbl-pagination',
//       element: lazy(() => import('./views/tables/react-table/Pagination'))
//     },
//     {
//       exact: 'true',
//       path: '/charts/apex-chart',
//       element: lazy(() => import('./views/charts/apex-chart'))
//     },
//     {
//       exact: 'true',
//       path: '/charts/chart-js',
//       element: lazy(() => import('./views/charts/chart-js'))
//     },
//     {
//       exact: 'true',
//       path: '/charts/highchart',
//       element: lazy(() => import('./views/charts/highchart'))
//     },
//     {
//       exact: 'true',
//       path: '/charts/rechart',
//       element: lazy(() => import('./views/charts/re-chart'))
//     },
//     {
//       exact: 'true',
//       path: '/maps/google-map',
//       element: lazy(() => import('./views/maps/GoogleMaps'))
//     },
//     {
//       exact: 'true',
//       path: '/maps/vector-map',
//       element: lazy(() => import('./views/maps/VectorMaps'))
//     },
//     {
//       exact: 'true',
//       path: '/todo/todo-basic',
//       element: lazy(() => import('./views/applications/to-do/ToDo'))
//     },
//     {
//       exact: 'true',
//       path: '/task/task-list',
//       element: lazy(() => import('./views/applications/task/TaskList'))
//     },
//     {
//       exact: 'true',
//       path: '/task/task-board',
//       element: lazy(() => import('./views/applications/task/TaskBoard'))
//     },
//     {
//       exact: 'true',
//       path: '/task/task-detail',
//       element: lazy(() => import('./views/applications/task/TaskDetails'))
//     },
//     {
//       exact: 'true',
//       path: '/gallery/gallery-grid',
//       element: lazy(() => import('./views/applications/gallery/GalleryGrid'))
//     },
//     {
//       exact: 'true',
//       path: '/gallery/photo-grid',
//       element: lazy(() => import('./views/applications/gallery/PhotoGrid'))
//     },
//     {
//       exact: 'true',
//       path: '/gallery/gallery-masonry',
//       element: lazy(() => import('./views/applications/gallery/MasonryGallery'))
//     },
//     {
//       exact: 'true',
//       path: '/editor/ck-editor/ck-classic',
//       element: lazy(() => import('./views/extensions/editors/ck-editor/EditorCkClassic'))
//     },
//     {
//       exact: 'true',
//       path: '/editor/ck-editor/ck-balloon',
//       element: lazy(() => import('./views/extensions/editors/ck-editor/EditorCkBalloon'))
//     },
//     {
//       exact: 'true',
//       path: '/editor/ck-editor/ck-inline',
//       element: lazy(() => import('./views/extensions/editors/ck-editor/EditorCkInline'))
//     },
//     {
//       exact: 'true',
//       path: '/editor/ck-editor/ck-document',
//       element: lazy(() => import('./views/extensions/editors/ck-editor/EditorCkDocument'))
//     },
//     {
//       exact: 'true',
//       path: '/editor/rich-editor',
//       element: lazy(() => import('./views/extensions/editors/EditorRichNib'))
//     },
//     {
//       exact: 'true',
//       path: '/editor/jodit-wysiwyg',
//       element: lazy(() => import('./views/extensions/editors/EditorJoditWYSIWYG'))
//     },
//     {
//       exact: 'true',
//       path: '/image-cropper',
//       element: lazy(() => import('./views/extensions/ImageCropper'))
//     },
//     {
//       exact: 'true',
//       path: '/file-upload',
//       element: lazy(() => import('./views/extensions/FileUpload'))
//     },
//     {
//       exact: 'true',
//       path: '/full-calendar',
//       element: lazy(() => import('./views/extensions/FullEventCalendar'))
//     },
//     {
//       exact: 'true',
//       path: '/invoice/invoice-basic',
//       element: lazy(() => import('./views/extensions/invoice/InvoiceBasic'))
//     },
//     {
//       exact: 'true',
//       path: '/invoice/invoice-summary',
//       element: lazy(() => import('./views/extensions/invoice/InvoiceSummary'))
//     },
//     {
//       exact: 'true',
//       path: '/invoice/invoice-list',
//       element: lazy(() => import('./views/extensions/invoice/InvoiceList'))
//     },
//     {
//       exact: 'true',
//       path: '/sample-page',
//       element: lazy(() => import('./views/extra/SamplePage'))
//     },
//     {
//       path: '*',
//       exact: 'true',
//       element: () => <Navigate to={BASE_URL} />
//     }
//   ]
// }

export default renderRoutes;
