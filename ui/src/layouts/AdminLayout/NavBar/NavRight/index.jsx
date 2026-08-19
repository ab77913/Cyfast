import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelectedProject } from 'contexts/ProjectContext';

// react-bootstrap
import { ListGroup, Dropdown, Card } from 'react-bootstrap';

// third party
import PerfectScrollbar from 'react-perfect-scrollbar';

// project import
import ChatList from './ChatList';
import { ConfigContext } from '../../../../contexts/ConfigContext';
import useAuth from '../../../../hooks/useAuth';
import {
  listUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead
} from 'utils/apiServices';

// assets
import avatar1 from '../../../../assets/images/user/avatar-1.jpg';

// ==============================|| NAV RIGHT ||============================== //

const NavRight = () => {
  const configContext = useContext(ConfigContext);
  const { logout, user } = useAuth();
  const { rtlLayout } = configContext.state;
  const { setSelectedProjectInContext } = useSelectedProject();

  const [listOpen, setListOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notiDropdownOpen, setNotiDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await listUserNotifications({ limit: 40 });
      const payload = res.data || {};
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload.unread_count) || 0);
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const iv = window.setInterval(loadNotifications, 35000);
    return () => window.clearInterval(iv);
  }, [loadNotifications]);

  const handleLogout = async () => {
    try {
      setSelectedProjectInContext(null);
      localStorage.removeItem('selectedProjectInContext');
      await logout();
      navigate('/projects');
    } catch (err) {
      console.error(err);
    }
  };

  const formatNotiWhen = (row) => {
    const raw = row?.created_date;
    if (!raw) return '';
    try {
      return new Date(raw).toLocaleString();
    } catch {
      return '';
    }
  };

  const handleMarkOneRead = async (e, n) => {
    e.preventDefault();
    e.stopPropagation();
    const nid =
      n.user_notification_id ??
      n.notification_id; /* legacy serialized key */
    if (!nid || n.read_at) return;
    try {
      await markUserNotificationRead(nid);
      loadNotifications();
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllRead = async (e) => {
    e.preventDefault();
    try {
      await markAllUserNotificationsRead();
      loadNotifications();
    } catch {
      /* ignore */
    }
  };

  const showBadge = unreadCount > 0;
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <React.Fragment>
      <ListGroup as="ul" bsPrefix=" " className="navbar-nav ml-auto">
        <ListGroup.Item as="li" bsPrefix=" ">
          {/* <Dropdown align={!rtlLayout ? 'end' : 'start'} className="drp-user">
            ...
                {currencies.map((item, index) => (
            ...
          </Dropdown> */}
        </ListGroup.Item>
        <ListGroup.Item as="li" bsPrefix=" ">
          <Dropdown
            align={!rtlLayout ? 'end' : 'start'}
            show={notiDropdownOpen}
            onToggle={(open) => {
              setNotiDropdownOpen(open);
              if (open) loadNotifications();
            }}
          >
            <Dropdown.Toggle as={Link} variant="link" to="#" id="dropdown-basic">
              <i className="feather icon-bell icon" />
              {showBadge ? (
                <span className="badge rounded-pill bg-danger">{badgeLabel}</span>
              ) : (
                <span className="badge rounded-pill bg-secondary" />
              )}
            </Dropdown.Toggle>
            <Dropdown.Menu align="end" className="notification notification-scroll">
              <div className="noti-head">
                <h6 className="d-inline-block m-b-0">Notifications</h6>
                <div className="float-end">
                  <Link
                    to="#"
                    style={{ textDecoration: 'none' }}
                    className="m-r-10"
                    onClick={handleMarkAllRead}
                  >
                    mark all read
                  </Link>
                </div>
              </div>
              <PerfectScrollbar style={{ height: '280px' }}>
                <ListGroup as="ul" bsPrefix=" " variant="flush" className="noti-body">
                  {notifications.length === 0 ? (
                    <ListGroup.Item as="li" bsPrefix=" " className="px-3 py-3 text-muted small">
                      No notifications yet
                    </ListGroup.Item>
                  ) : (
                    notifications.map((n) => {
                      const nid =
                        n.user_notification_id ??
                        n.notification_id;
                      const unread = !n.read_at;
                      return (
                        <ListGroup.Item
                          key={nid || JSON.stringify(n)}
                          as="li"
                          bsPrefix=" "
                          className="notification"
                          action
                          onClick={(e) => handleMarkOneRead(e, n)}
                          style={{
                            opacity: unread ? 1 : 0.75,
                            cursor: unread ? 'pointer' : 'default'
                          }}
                        >
                          <Card
                            className="d-flex align-items-center shadow-none mb-0 p-0"
                            style={{ flexDirection: 'row', backgroundColor: 'unset' }}
                          >
                            <Card.Body className="p-0">
                              <p className="mb-1">
                                <strong>{n.title || 'Update'}</strong>
                                {!n.read_at && (
                                  <span className="n-time text-muted float-end ms-2 small">
                                    • new
                                  </span>
                                )}
                                <span className="n-time text-muted">
                                  <i className="icon feather icon-clock me-2" />
                                  {formatNotiWhen(n)}
                                </span>
                              </p>
                              <p className="mb-0 small">{n.body}</p>
                            </Card.Body>
                          </Card>
                        </ListGroup.Item>
                      );
                    })
                  )}
                </ListGroup>
              </PerfectScrollbar>
            </Dropdown.Menu>
          </Dropdown>
        </ListGroup.Item>
        <ListGroup.Item as="li" bsPrefix=" ">
          <Dropdown
            align={!rtlLayout ? 'end' : 'start'}
            className="drp-user"
            show={profileDropdownOpen}
            onToggle={() => setProfileDropdownOpen(!profileDropdownOpen)}
          >
            <Dropdown.Toggle as={Link} variant="link" to="#" id="dropdown-basic">
              <img src={avatar1} className="img-radius wid-40" alt="User Profile" />
            </Dropdown.Toggle>
            <Dropdown.Menu align="end" className="profile-notification">
              <div className="pro-head">
                <img src={avatar1} className="img-radius" alt="User Profile" />
                <div className="user-info">
                  <span>{user?.name}</span>
                  <span className="text-muted medium">{user?.role}</span>
                </div>
              </div>
              <ListGroup as="ul" bsPrefix=" " variant="flush" className="pro-body">
                <ListGroup.Item as="li" bsPrefix=" ">
                  <Link to="/admin/users" className="dropdown-item" onClick={() => setProfileDropdownOpen(false)}>
                    <i className="feather icon-settings" /> Admin
                  </Link>
                </ListGroup.Item>
                <ListGroup.Item as="li" bsPrefix=" ">
                  <Link to="/user/profile" className="dropdown-item" onClick={() => setProfileDropdownOpen(false)}>
                    <i className="feather icon-user" /> Profile
                  </Link>
                </ListGroup.Item>
                <ListGroup.Item as="li" bsPrefix=" ">
                  <Link to="#" className="dropdown-item" onClick={handleLogout}>
                    <i className="feather icon-log-out" /> Logout
                  </Link>
                </ListGroup.Item>
              </ListGroup>
            </Dropdown.Menu>
          </Dropdown>
        </ListGroup.Item>
      </ListGroup>
      <ChatList listOpen={listOpen} closed={() => setListOpen(false)} />
    </React.Fragment>
  );
};

export default NavRight;
