/* views/projects/List**/
import React, { useState, useMemo, useEffect } from 'react';
import { Card, Row, Col, Tabs, Tab, Form, Button } from 'react-bootstrap';
import BTable from 'react-bootstrap/Table';
import { useTable, useSortBy } from 'react-table';
import { sortOptions, statusMap } from 'data/listData';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import ProjectFormModal from './modals/ProjectFormModal';
import ProjectConfigModal from './modals/ProjectConfigModal';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import ProjectActionLinks from './ProjectActionLinks';
import { getProjects, deleteProject } from 'utils/apiServices';
import { useSelectedProject } from 'contexts/ProjectContext';
import Spinner from 'react-bootstrap/Spinner';
import SuccessModal from 'views/shared-modals/SuccessModal';

function Table({ columns, data }) {
  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, rows } = useTable(
    {
      columns,
      data
    },
    useSortBy
  );

  return (
    <BTable hover responsive className="custom-cyfast-table" {...getTableProps()}>
      <thead>
        {headerGroups.map((headerGroup, i) => (
          <tr key={i} {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column, i) => (
              <th key={i} {...column.getHeaderProps(column.getSortByToggleProps())} className="header-text">
                {column.render('Header')}
                <span>
                  {column.isSorted ? (
                    column.isSortedDesc ? (
                      <span className="feather icon-arrow-down text-muted float-end" />
                    ) : (
                      <span className="feather icon-arrow-up text-muted float-end" />
                    )
                  ) : (
                    ''
                  )}
                </span>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row, i) => {
          prepareRow(row);
          return (
            <tr key={i} {...row.getRowProps()}>
              {row.cells.map((cell, i) => (
                <td key={i} {...cell.getCellProps()}>
                  {cell.render('Cell')}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </BTable>
  );
}

const List = () => {
  const navigate = useNavigate();
  const columns = React.useMemo(
    () => [
      {
        Header: 'Project Name',
        accessor: 'name',
        Cell: ({ value, row }) => (
          <button className="fw-bold project-link" onClick={() => handleProjectClick(row.original)}>
            {value}
          </button>
        )
      },
      {
        Header: 'Project Type',
        accessor: 'type',
        Cell: ({ value }) => <span className="header-text">{value}</span>
      },
      {
        Header: 'Owner Email',
        accessor: 'created_by',
        Cell: ({ value }) => <span className="header-text">{value}</span>
      },
      {
        Header: 'Created Date',
        accessor: 'date',
        Cell: ({ value }) => <span className="header-text">{value}</span>
      },
      {
        Header: 'Status',
        accessor: 'status',
        Cell: ({ value }) => {
          const details = Object.values(statusMap).find((item) => item.value === value);
          return <span className={`badge px-3 py-2 ${details?.className || 'bg-secondary'}`}>{details?.label || value}</span>;
        }
      },

      { Header: 'Actions', accessor: 'action' }
    ],
    []
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState(''); // default sort by name
  const [activeTab, setActiveTab] = useState('all'); // default active tab ALL
  const [viewMode, setViewMode] = useState('list'); // default: list View

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { setSelectedProjectInContext } = useSelectedProject(); // project context

  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isProjectConfigOpen, setProjectConfigOpen] = useState(false);
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const showProjectFormModal = () => setIsProjectFormOpen(true);
  const hideProjectFormModal = () => {
    setSelectedProject({});
    setIsProjectFormOpen(false);
  };
  const showProjectConfigModal = () => setProjectConfigOpen(true);
  const hideProjectConfigModal = () => {
    setSelectedProject({});
    setProjectConfigOpen(false);
  };
  const showConfirmDeleteModal = () => setConfirmDeleteOpen(true);
  const hideConfirmDeleteModal = () => {
    setSelectedProject({});
    setConfirmDeleteOpen(false);
  };

  // get Projects api call
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const response = await getProjects();
      setProjects(response.data.data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const afterProjectEntry = () => {
    hideProjectFormModal();
    setSuccessMessage(`Project ${selectedProject.name} has been added successfully.`);
    setShowSuccessModal(true);
    setSelectedProject({});
    fetchProjects();
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  const afterConfigUpdate = () => {
    hideProjectConfigModal();
    setSuccessMessage(`Project ${selectedProject.name} configuration has been updated successfully.`);
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  const formattedProjects = useMemo(() => {
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };

    return projects.map((p) => {
      const dt = new Date(p.created_date);
      const datePart = dt.toLocaleDateString('en-US', dateOptions);
      const timePart = dt.toLocaleTimeString('en-US', timeOptions);
      return {
        ...p,
        id: p.project_id,
        date: `${datePart}, ${timePart}`,
        status: p.status,
        statusVal: p.status
      };
    });
  }, [projects]);

  // Filter and sort data based on searchTerm and sortBy
  const filteredData = useMemo(() => {
    let filtered = formattedProjects.filter(
      (p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortBy?.value) {
      filtered.sort((a, b) => (a[sortBy.value] || '').localeCompare(b[sortBy.value] || ''));
    }
    return filtered;
  }, [formattedProjects, searchTerm, sortBy]);

  // Helper function to filter by tab
  const filterByTab = (projects, tabKey) => {
    if (tabKey === 'all') return projects;

    return projects.filter((p) => {
      return p.statusVal === tabKey;
    });
  };

  const handleProjectClick = (project) => {
    if (!project || !project.project_id) {
      console.warn('Invalid project clicked:', project);
      return;
    }

    const allowedKeys = [
      'build_version',
      'created_by',
      'created_date',
      'date',
      'deleted_by',
      'deleted_date',
      'description',
      'id',
      'modified_by',
      'modified_date',
      'name',
      'organization_id',
      'phase',
      'project_id',
      'status',
      'statusVal',
      'type',
      'version',
      'email'
    ];

    const projectData = Object.fromEntries(Object.entries(project).filter(([key]) => allowedKeys.includes(key)));

    try {
      setSelectedProjectInContext(projectData); // Save project data only to project context
      navigate('/projects/dashboard'); // project analytics dashboard is the workspace landing
    } catch (error) {
      console.error('Error setting selected project:', error);
    }
  };

  const handleProjectDelete = async () => {
    try {
      const response = await deleteProject(selectedProject.project_id);

      console.log('delete project api resp: ', response);
      if (response.status === 200 && response.data === true) {
        hideConfirmDeleteModal();
        setSuccessMessage(`Entire ${selectedProject.name} has been deleted successfully`);
        setShowSuccessModal(true);
        fetchProjects();

        setTimeout(() => {
          setShowSuccessModal(false);
          setSelectedProject({});
        }, 2000);
      }
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setConfirmDeleteOpen(false);
    }
  };

  const selectStyles = {
    control: (base) => ({
      ...base,
      minHeight: 38,
      height: 38,
      fontSize: '0.875rem'
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999
    })
  };

  return (
    <div className="full-height position-relative">
      {isLoading && (
        <div className="spinner-overlay">
          <Spinner animation="border" variant="primary" role="status"></Spinner>
        </div>
      )}

      {/* === Project Tabs Section === */}
      {/* 6 Tabs */}
      <div className="d-flex justify-content-between align-items-center px-2 mb-3">
        <Tabs
          activeKey={activeTab}
          onSelect={(tabKey) => {
            setActiveTab(tabKey);
            setSortBy(sortOptions.find((option) => option.value === tabKey)); // sync with dropdown
          }}
          className="flex-grow-1 fast-tab" //Added custom scss
        >
          {['all', 'NEW', 'INPROGRESS', 'PAUSED', 'PASSED', 'FAILED', 'ERROR'].map((tabKey) => {
            const label = tabKey.toUpperCase();
            const count = filterByTab(filteredData, tabKey).length;
            const isActive = activeTab === tabKey;

            return (
              <Tab
                eventKey={tabKey}
                key={tabKey}
                title={
                  <span className="d-flex align-items-center gap-1 fw-semibold">
                    {label}
                    <span className={`tab-badge ${isActive ? 'active' : ''}`}>{count}</span>
                  </span>
                }
                tabClassName="me-3"
              />
            );
          })}
        </Tabs>

        {/* Add Project Button */}
        <div className="ms-3 mb-2 mt-1">
          <Button variant="primary" className="btn-md btn-round has-ripple ms-2" onClick={showProjectFormModal}>
            <i className="feather icon-plus" /> Add Project
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {/* Search and Sort UI */}
        <Row className="mb-3 align-items-center">
          <Col md={3}>
            <div className="input-group">
              <Form.Control
                type="search"
                placeholder="Search Project"
                value={searchTerm}
                className="search-input"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="input-group-text bg-white">
                <i className="feather icon-search light-icon" />
              </span>
            </div>
          </Col>

          {/* Sort Dropdown */}
          <Col md={2}>
            <Select
              classNamePrefix="select"
              name="sort"
              options={sortOptions}
              value={sortBy}
              onChange={(selectedOption) => {
                setActiveTab(selectedOption.value); // set tab
                setSortBy(selectedOption); // set dropdown
              }}
              className="bg-white"
              //placeholder="Sort by"
              placeholder={`${activeTab === 'all' ? 'All' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
              menuPortalTarget={document.body}
              styles={selectStyles}
            />
          </Col>

          {/* View Toggle Icons (list view & grid view) */}
          <Col md={7} className="text-end">
            <div className="d-flex justify-content-end gap-3">
              {/* List View */}
              <div
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setViewMode('list');
                  }
                }}
                onClick={() => setViewMode('list')}
                className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
                title="List View"
              >
                <i className="fa fa-list"></i>
              </div>
              {/* Grid View */}
              <div
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setViewMode('grid');
                  }
                }}
                onClick={() => setViewMode('grid')}
                className={`view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
                title="Grid View"
              >
                <i className="fa fa-th-large"></i>
              </div>
            </div>
          </Col>
        </Row>

        <div>
          {viewMode === 'list' ? (
            /**List View */
            <div className="scroll-container scroll-70vh">
              <Table
                columns={columns}
                data={filterByTab(
                  filteredData.map((project) => ({
                    ...project,
                    action: (
                      <ProjectActionLinks
                        project={project}
                        setSelectedProject={setSelectedProject}
                        showProjectFormModal={showProjectFormModal}
                        showProjectConfigModal={showProjectConfigModal}
                        showConfirmDeleteModal={showConfirmDeleteModal}
                      />
                    )
                  })),
                  activeTab
                )}
                onProjectClick={handleProjectClick}
              />
            </div>
          ) : (
            /**Grid View */
            <div className="scroll-container scroll-70vh">
              <Row xs={1} md={2} lg={3} className="project-grid-row">
                {filterByTab(filteredData, activeTab).map((project, idx) => (
                  <Col key={idx}>
                    {/* <Card className="h-100 shadow-sm"> */}
                    <Card
                      className="shadow-sm border border-light rounded transition"
                      onMouseEnter={(e) => {
                        e.currentTarget.classList.add('shadow', 'border-primary');
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.background = '#f8f9fc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.classList.remove('shadow', 'border-primary');
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.background = 'white';
                      }}
                    >
                      <Card.Body className="project-card-body">
                        {/* Row 1: Project Name & Date */}
                        <Row className="mb-2">
                          <Col>
                            <small className="text-muted mb-1">PROJECT NAME</small>
                            <div
                              className="fw-bold project-link"
                              role="button"
                              tabIndex={0}
                              onClick={() => handleProjectClick(project)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  handleProjectClick(project);
                                }
                              }}
                            >
                              {project.name}
                            </div>
                          </Col>
                          <Col className="text-end">
                            <div>{project.date}</div>
                          </Col>
                        </Row>

                        {/* Row 2: Type & Email */}
                        <Row className="mb-2">
                          <Col>
                            <small className="text-muted mb-1">PROJECT TYPE</small>
                            <div className="fw-bold text-small">{project.type}</div>
                          </Col>
                          <Col className="text-end">
                            <small className="text-muted mb-1">OWNER EMAIL</small>
                            <div className="fw-bold text-small">{project.email}</div>
                          </Col>
                        </Row>

                        <hr className="custom-hr" />

                        {/* Row 3: Status + Actions */}
                        <Row className="align-items-center mt-3">
                          <Col>
                            {(() => {
                              const status = project.statusVal || '';
                              const statusDetails = Object.values(statusMap).find((item) => item.value === status);

                              return (
                                <span className={`badge px-3 py-2 ${statusDetails?.className || 'bg-secondary'}`}>
                                  {statusDetails?.label || 'Unknown'}
                                </span>
                              );
                            })()}
                          </Col>
                          <Col className="text-end">
                            {
                              <ProjectActionLinks
                                project={project}
                                setSelectedProject={setSelectedProject}
                                showProjectFormModal={showProjectFormModal}
                                showProjectConfigModal={showProjectConfigModal}
                                showConfirmDeleteModal={showConfirmDeleteModal}
                              />
                            }
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          )}
        </div>
      </div>

      {/**Modal : for Add New Project */}
      <ProjectFormModal show={isProjectFormOpen} onHide={hideProjectFormModal} project={selectedProject} afterSuccess={afterProjectEntry} />
      <ProjectConfigModal
        show={isProjectConfigOpen}
        onHide={hideProjectConfigModal}
        project={selectedProject}
        afterSuccess={afterConfigUpdate}
      />
      <ConfirmDeleteModal
        show={isConfirmDeleteOpen}
        onHide={hideConfirmDeleteModal}
        onSubmit={handleProjectDelete}
        toDelete={selectedProject.name}
      />
      <SuccessModal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} message={successMessage} />
    </div>
  );
};
export default List;
