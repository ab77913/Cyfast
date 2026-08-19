import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';

// project import
//import NavLeft from './NavLeft';
import NavRight from './NavRight';

import { ConfigContext } from '../../../contexts/ConfigContext';
import * as actionType from '../../../store/actions';
import { useLocation, useNavigate } from 'react-router-dom';

// assets
import cyFastLogo from '../../../assets/images/auth/cyfast_white_std.png';
import NavMiddleTabs from './NavMiddleTabs';

// ==============================|| NAV BAR ||============================== //

const NavBar = () => {
  const [moreToggle, setMoreToggle] = useState(false);
  const configContext = useContext(ConfigContext);
  const { collapseMenu, headerBackColor, headerFixedLayout, layout, subLayout } = configContext.state;
  const { dispatch } = configContext;

  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  const projectDetailRoutes = new Set([
    '/projects/dashboard',
    '/projects/details',
    '/projects/orchestrations',
    '/projects/testcases',
    '/projects/requirements',
    '/projects/test-scenarios',
    '/projects/documents',
    '/projects/risks',
    '/projects/defects',
    '/projects/execution/history',
    '/projects/execution/analysis',
    '/projects/execution/scheduled',
    '/projects/test-recorder',
    '/projects/test-agents',
    '/projects/orchestrations/details/',
    '/projects/traceability'
  ]);
  const isProjectDetails = [...projectDetailRoutes].some((route) => location.pathname.startsWith(route)) || isAdmin;

  const getInitialTab = () => {
    if (location.pathname.includes('/details')) return 'projects';
    if (location.pathname.includes('/reports')) return 'projects';
    return 'projects'; // default tab
  };
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const showToggleMenu = isProjectDetails; // Only show toggle menu on sidebar for project-detailed views

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'dashboard') navigate('/projects/dashboard');
    else if (key === 'projects') navigate('/projects');
    else if (key === 'report-customization') navigate('/report-customization');
    else if (key === 'test-agents') navigate('/test-agents');
    else if (key === 'windows-nodes') navigate('/resources/windows-nodes');
  };

  let headerClass = ['navbar', 'pcoded-header', 'navbar-expand-lg', headerBackColor];
  if (headerFixedLayout && layout === 'vertical') {
    headerClass = [...headerClass, 'headerpos-fixed'];
  }

  let toggleClass = ['mobile-menu'];
  if (collapseMenu) {
    toggleClass = [...toggleClass, 'on'];
  }

  const navToggleHandler = () => {
    dispatch({ type: actionType.COLLAPSE_MENU });
  };

  let moreClass = ['mob-toggler'];
  let collapseClass = ['collapse navbar-collapse'];
  if (moreToggle) {
    moreClass = [...moreClass, 'on'];
    collapseClass = [...collapseClass, 'd-block'];
  }

  let navBar = (
    <React.Fragment>
      <div className="m-header">
        {showToggleMenu && (
          <Link to="#" className={toggleClass.join(' ')} id="mobile-collapse" onClick={navToggleHandler}>
            <span />
          </Link>
        )}
        <Link to="#" className="b-brand">
          <img id="main-logo" src={cyFastLogo} alt="" />
        </Link>
        <Link to="#" className={moreClass.join(' ')} onClick={() => setMoreToggle(!moreToggle)}>
          <i className="feather icon-more-vertical" />
        </Link>
      </div>
      <div style={{ justifyContent: 'end' }} className={collapseClass.join(' ')}>
        {/* <NavLeft /> */}
        <NavMiddleTabs activeTab={activeTab} onSelectTab={handleTabChange} />
        <NavRight />
      </div>
    </React.Fragment>
  );

  if (layout === 'horizontal' && subLayout === 'horizontal-2') {
    navBar = <div className="container">{navBar}</div>;
  }

  return (
    <React.Fragment>
      <header className={headerClass.join(' ')} style={{ zIndex: 1009 }}>
        {navBar}
      </header>
    </React.Fragment>
  );
};

export default NavBar;
