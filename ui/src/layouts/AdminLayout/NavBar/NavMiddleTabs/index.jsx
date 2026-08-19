import React from 'react';
import { Nav } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

const windowsEnabled = import.meta.env.VITE_WINDOWS_AUTOMATION_ENABLED === 'true';

const NavMiddleTabs = () => {
  const location = useLocation();
  let activeTab = 'dashboard';

  if (location.pathname.startsWith('/report-customization')) {
    activeTab = 'report-customization';
  } else if (location.pathname.startsWith('/resources/windows-nodes')) {
    activeTab = 'windows-nodes';
  } else if (location.pathname === '/projects/dashboard') {
    activeTab = 'dashboard';
  } else if (location.pathname.startsWith('/projects')) {
    activeTab = 'projects';
  } else if (location.pathname.startsWith('/test-agents')) {
    activeTab = 'test-agents';
  }

  return (
    <Nav variant="tabs" activeKey={activeTab} className="mx-auto nav-middle-tabs custom-tabs">
      <Nav.Item>
        <Nav.Link as={Link} to="/projects/dashboard" eventKey="dashboard">
          <i className="feather icon-home me-2 fs-5"></i>
          Dashboard
        </Nav.Link>
      </Nav.Item>
      <Nav.Item>
        <Nav.Link as={Link} to="/projects" eventKey="projects">
          <i className="feather icon-briefcase me-2 fs-5" /> Projects
        </Nav.Link>
      </Nav.Item>
      <Nav.Item>
        <Nav.Link as={Link} to="/test-agents" eventKey="test-agents">
          <i className="feather icon-server me-2 fs-5" /> Test Agents
        </Nav.Link>
      </Nav.Item>
      {windowsEnabled && (
        <Nav.Item>
          <Nav.Link as={Link} to="/resources/windows-nodes" eventKey="windows-nodes">
            <i className="feather icon-monitor me-2 fs-5" /> Windows Nodes
          </Nav.Link>
        </Nav.Item>
      )}
      <Nav.Item>
        <Nav.Link as={Link} to="/report-customization" eventKey="report-customization">
          <i className="feather icon-file-text me-2 fs-5" /> Report Customization
        </Nav.Link>
      </Nav.Item>
    </Nav>
  );
};

export default NavMiddleTabs;
