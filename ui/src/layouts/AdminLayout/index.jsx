import React, { useContext, useEffect, useRef } from 'react';

// project import
import Navigation from './Navigation';
import NavBar from './NavBar';
import Breadcrumb from './Breadcrumb';
import Configuration from './Configuration';
import ProjectDocumentChatPanel from '../../views/projects/ProjectDocumentChatPanel';

import useWindowSize from '../../hooks/useWindowSize';
import useOutsideClick from '../../hooks/useOutsideClick';
import { ConfigContext } from '../../contexts/ConfigContext';
import * as actionType from '../../store/actions';
import { useLocation } from 'react-router-dom';

// ==============================|| ADMIN LAYOUT ||============================== //

const AdminLayout = ({ children }) => {
  const windowSize = useWindowSize();
  const ref = useRef();
  const configContext = useContext(ConfigContext);
  const location = useLocation();

  const isAdmin = location.pathname.startsWith('/admin');
  const isProfile = location.pathname === '/user/profile';

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
    '/projects/traceability'
  ]);

  const isProjectList = location.pathname === '/projects';
  const isProjectDetails = [...projectDetailRoutes].some((route) => location.pathname.startsWith(route));
  const isReportCustomization = location.pathname === '/report-customization';
  const isTestAgents = location.pathname === '/test-agents';
  const isWindowsNodes = location.pathname.startsWith('/resources/windows-nodes');

  const showSidebar = isProjectDetails || isAdmin; // Only show sidebar on project-related views and admin-realted views
  const showNavBar =
    isProjectList || isProjectDetails || isReportCustomization || isTestAgents || isWindowsNodes || isAdmin || isProfile; // Show header

  const { collapseMenu, layout, subLayout, headerFixedLayout } = configContext.state;
  const { dispatch } = configContext;

  useOutsideClick(ref, () => {
    if (collapseMenu) {
      dispatch({ type: actionType.COLLAPSE_MENU });
    }
  });

  useEffect(() => {
    if (windowSize.width > 992 && windowSize.width <= 1024 && layout !== 'horizontal') {
      dispatch({ type: actionType.COLLAPSE_MENU });
    }

    if (layout === 'horizontal' && windowSize.width < 992) {
      dispatch({ type: actionType.CHANGE_LAYOUT, layout: 'vertical' });
    }
  }, [dispatch, layout, windowSize]);

  const mobileOutClickHandler = () => {
    if (windowSize.width < 992 && collapseMenu) {
      dispatch({ type: actionType.COLLAPSE_MENU });
    }
  };

  let mainClass = ['pcoded-wrapper'];
  if (layout === 'horizontal' && subLayout === 'horizontal-2') {
    mainClass = [...mainClass, 'container'];
  }

  let common = (
    <React.Fragment>
      {showSidebar && <Navigation />} {/* side menu*/}
      {showNavBar && <NavBar />} {/* Header*/}
    </React.Fragment>
  );

  if (windowSize.width < 992) {
    let outSideClass = ['nav-outside'];
    if (collapseMenu) {
      outSideClass = [...outSideClass, 'mob-backdrop'];
    }
    if (headerFixedLayout) {
      outSideClass = [...outSideClass, 'mob-fixed'];
    }

    common = (
      <div className={outSideClass.join(' ')} ref={ref}>
        {/* {common} */}
        {showSidebar && <Navigation />} {/* side menu*/}
        {showNavBar && <NavBar />} {/* Header*/}
      </div>
    );
  }

  return (
    <React.Fragment>
      {common}
      <div
        className={`pcoded-main-container ${!showSidebar ? 'no-sidebar' : ''}`}
        onClick={mobileOutClickHandler}
        onKeyDown={mobileOutClickHandler}
      >
        <div className={mainClass.join(' ')}>
          <div className="pcoded-content">
            <div className="pcoded-inner-content">
              <Breadcrumb />
              {children}
            </div>
          </div>
        </div>
      </div>
      <Configuration />
      {showSidebar && !isAdmin && <ProjectDocumentChatPanel />}
    </React.Fragment>
  );
};

export default AdminLayout;
