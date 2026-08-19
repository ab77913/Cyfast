import { FormattedMessage } from 'react-intl';

const adminMenuItems = {
  items: [
    {
      id: 'admin-group',
      title: <FormattedMessage id="admin" />,
      type: 'group',
      icon: 'feather icon-settings',
      children: [
        {
          id: 'users',
          title: <FormattedMessage id="users" />,
          type: 'item',
          icon: 'feather icon-users',
          url: '/admin/users',
          classes: 'nav-item',
          breadcrumbs: false
        },
        {
          id: 'roles',
          title: <FormattedMessage id="roles" />,
          type: 'item',
          icon: 'feather icon-briefcase',
          url: '/admin/roles',
          classes: 'nav-item',
          breadcrumbs: false
        },
        {
          id: 'permissions',
          title: <FormattedMessage id="permissions" />,
          type: 'item',
          icon: 'feather icon-lock',
          url: '/admin/permissions',
          classes: 'nav-item',
          breadcrumbs: false
        }
      ]
    }
  ]
};

export default adminMenuItems;
