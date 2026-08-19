// third party

import { FormattedMessage } from 'react-intl';
const menuItems = {
  items: [
    ...(import.meta.env.VITE_WINDOWS_AUTOMATION_ENABLED === 'true'
      ? [
          {
            id: 'resources',
            title: 'Resources',
            type: 'group',
            icon: 'feather icon-server',
            children: [
              {
                id: 'windows-nodes',
                title: 'Windows Nodes',
                type: 'item',
                icon: 'feather icon-monitor',
                url: '/resources/windows-nodes',
                classes: 'nav-item',
                breadcrumbs: false
              }
            ]
          }
        ]
      : []),
    {
      id: 'navigation',
      title: <FormattedMessage id="navigation" />,
      type: 'group',
      icon: 'icon-navigation',
      children: [
        {
          id: 'dashboard',
          title: <FormattedMessage id="dashboard" />,
          type: 'item',
          icon: 'feather icon-home',
          url: '/projects/dashboard',
          classes: 'nav-item',
          breadcrumbs: false
        },
        {
          id: 'details',
          title: <FormattedMessage id="details" />,
          type: 'item',
          icon: 'feather icon-clipboard',
          url: '/projects/details',
          classes: 'nav-item',
          breadcrumbs: false
        },
        {
          id: 'documents',
          title: <FormattedMessage id="documents" />,
          type: 'item',
          icon: 'feather icon-file-text',
          url: '/projects/documents',
          classes: 'nav-item',
          breadcrumbs: false
        },
        {
          id: 'orchestrations',
          title: <FormattedMessage id="orchestrations" />,
          type: 'item',
          icon: 'feather icon-layout',
          url: '/projects/orchestrations',
          classes: 'nav-item',
          breadcrumbs: false
        },
        // {
        //   id: 'project-test-agents',
        //   title: <FormattedMessage id="test-agents" />,
        //   type: 'item',
        //   icon: 'feather icon-server',
        //   url: '/projects/test-agents',
        //   classes: 'nav-item',
        //   breadcrumbs: false
        // },
        {
          id: 'inventory',
          title: <FormattedMessage id="inventory" />,
          type: 'collapse',
          icon: 'feather icon-package',
          children: [
            {
              id: 'test-cases',
              title: <FormattedMessage id="test-cases" />,
              type: 'item',
              url: '/projects/testcases',
              breadcrumbs: false
            },
            {
              id: 'requirements',
              title: <FormattedMessage id="requirements" />,
              type: 'item',
              url: '/projects/requirements',
              breadcrumbs: false
            },
            {
              id: 'test-scenarios',
              title: <FormattedMessage id="test-scenarios" />,
              type: 'item',
              url: '/projects/test-scenarios',
              breadcrumbs: false
            },

            {
              id: 'risks',
              title: <FormattedMessage id="risks" />,
              type: 'item',
              url: '/projects/risks',
              breadcrumbs: false
            },
            {
              id: 'defects',
              title: <FormattedMessage id="defects" />,
              type: 'item',
              url: '/projects/defects',
              breadcrumbs: false
            },
            {
              id: 'traceability',
              title: <FormattedMessage id="traceability" />,
              type: 'item',
              url: '/projects/traceability',
              breadcrumbs: false
            }
          ]
        },
        {
          id: 'test-recorder',
          title: <FormattedMessage id="test-recorder" />,
          type: 'item',
          icon: 'feather icon-target',
          url: '/projects/test-recorder',
          classes: 'nav-item',
          breadcrumbs: false
        },
        {
          id: 'execution',
          title: <FormattedMessage id="execution" />,
          type: 'collapse',
          icon: 'feather icon-activity',
          // badge: {
          //   title: 'New',
          //   type: 'bg-warning'
          // },
          children: [
            // {
            //   id: 'calendar',
            //   title: <FormattedMessage id="Calendar" />,
            //   type: 'item',
            //   url: '/projects/execution/scheduled',
            //   breadcrumbs: false
            // },
            {
              id: 'history',
              title: <FormattedMessage id="history" />,
              type: 'item',
              url: '/projects/execution/history',
              breadcrumbs: false
            },
            {
              id: 'analysis',
              title: <FormattedMessage id="analysis" />,
              type: 'item',
              url: '/projects/execution/analysis',
              breadcrumbs: false
            }
          ]
        }
        // {
        //   id: 'report-customization',
        //   title: <FormattedMessage id="report-customization" />,
        //   type: 'item',
        //   icon: 'feather icon-file-text',
        //   url: '/report-customization',
        //   breadcrumbs: false
        // }
      ]
    }
  ]
};

export default menuItems;
