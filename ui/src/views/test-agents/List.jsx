import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Row, Col, Form, Button } from 'react-bootstrap';
import BTable from 'react-bootstrap/Table';
import { useTable, useSortBy } from 'react-table';
import { Link } from 'react-router-dom';
import Select from 'react-select';
import Spinner from 'react-bootstrap/Spinner';
import {
  getTestAgents,
  stopTestAgent,
  deleteTestAgent,
  bulkDeleteTestAgents
} from 'utils/apiServices';
import ConfirmDeleteModal from 'views/shared-modals/ConfirmDeleteModal';
import { testAgentSortOptions, testAgentStatusColorMap } from 'data/testAgentsData';
import ProjectMappingModal from './modals/ProjectMappingModal';
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
            {headerGroup.headers.map((column, j) => (
              <th key={j} {...column.getHeaderProps(column.getSortByToggleProps())} className="header-text">
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
              {row.cells.map((cell, j) => (
                <td key={j} {...cell.getCellProps()}>
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

const ActionButtons = ({ agent, onMapping, onStop, onDelete }) => {
  return (
    <>
      <Link
        to="#"
        className="text-success mx-1"
        title="Map to projects"
        onClick={(e) => {
          e.preventDefault();
          onMapping(agent);
        }}
      >
        <i className="feather icon-link icon-action" />
      </Link>

      <Link
        to="#"
        className="text-danger mx-1"
        title="Delete"
        hidden={agent.status !== 'DEAD'}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(agent);
        }}
      >
        <i className="feather icon-trash-2 icon-action delete" />
      </Link>

      <Link
        to="#"
        className="text-warning mx-1"
        title="Stop"
        hidden={agent.status === 'DEAD'}
        onClick={(e) => {
          e.preventDefault();
          onStop(agent);
        }}
      >
        <i className="feather icon-stop-circle icon-md text-warning icon-action" />
      </Link>
    </>
  );
};

const List = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testAgents, setTestAgents] = useState([]);
  const [selectedTestAgent, setSelectedTestAgent] = useState({});
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [mappingModalAgents, setMappingModalAgents] = useState([]);

  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);

  const showConfirmDeleteModal = () => setConfirmDeleteOpen(true);
  const hideConfirmDeleteModal = () => {
    setSelectedTestAgent({});
    setConfirmDeleteOpen(false);
  };

  useEffect(() => {
    fetchTestAgents();

    const intervalId = setInterval(() => {
      fetchTestAgents();
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchTestAgents = async () => {
    try {
      setIsLoading(true);
      const response = await getTestAgents();
      setTestAgents(response.data.data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState({ value: 'All', label: 'All' });

  const filteredData = useMemo(() => {
    let filtered = testAgents.filter(
      (agent) =>
        agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (statusFilter?.value && statusFilter.value !== 'All') {
      filtered = filtered.filter((agent) => agent.status === statusFilter.value);
    }

    return filtered;
  }, [testAgents, searchTerm, statusFilter]);

  useEffect(() => {
    const valid = new Set(filteredData.map((a) => a.test_agent_id));
    setSelectedRowIds((prev) => new Set([...prev].filter((id) => valid.has(id))));
  }, [filteredData]);

  const selectedAgents = useMemo(
    () => filteredData.filter((a) => selectedRowIds.has(a.test_agent_id)),
    [filteredData, selectedRowIds]
  );

  const allFilteredSelected =
    filteredData.length > 0 && filteredData.every((a) => selectedRowIds.has(a.test_agent_id));
  const toggleRowSelected = useCallback((id) => {
    setSelectedRowIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedRowIds(new Set(filteredData.map((a) => a.test_agent_id)));
  }, [filteredData]);

  const clearRowSelection = useCallback(() => {
    setSelectedRowIds(new Set());
  }, []);

  const selectedAllDead =
    selectedAgents.length > 0 && selectedAgents.every((a) => a.status === 'DEAD');

  const handleOpenMapping = useCallback((agent) => {
    setMappingModalAgents([agent]);
    setShowMappingModal(true);
  }, []);

  const handleOpenBulkMapping = useCallback(() => {
    if (!selectedAgents.length) return;
    setMappingModalAgents([...selectedAgents]);
    setShowMappingModal(true);
  }, [selectedAgents]);

  const handleMappingSuccess = async (bulkPayload) => {
    let msg =
      mappingModalAgents.length > 1
        ? bulkPayload?.succeeded != null
          ? bulkPayload.failed > 0
            ? `Updated ${bulkPayload.succeeded} agent(s); ${bulkPayload.failed} failed.`
            : `Mapped projects on ${bulkPayload.succeeded} agent(s).`
          : `Mapping succeeded for ${mappingModalAgents.length} agents.`
        : `Mapping projects to Agent ${mappingModalAgents[0]?.name ?? ''} is successfully`;

    setSuccessMessage(msg);
    setShowSuccessModal(true);
    await fetchTestAgents();
    clearRowSelection();
    setTimeout(() => {
      setShowSuccessModal(false);
      setMappingModalAgents([]);
    }, 2200);
  };

  const handleSingleDeletePrep = useCallback((agent) => {
    setSelectedTestAgent(agent);
    showConfirmDeleteModal();
  }, []);

  const handleAgentDelete = async () => {
    try {
      const response = await deleteTestAgent(selectedTestAgent.test_agent_id);

      if (response.status === 200) {
        hideConfirmDeleteModal();
        setSuccessMessage(`Entire ${selectedTestAgent.name} has been deleted successfully`);
        setShowSuccessModal(true);
        fetchTestAgents();
        setTimeout(() => {
          setShowSuccessModal(false);
          setSelectedTestAgent({});
        }, 2000);
      }
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setConfirmDeleteOpen(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const ids = [...selectedRowIds];
      const res = await bulkDeleteTestAgents(ids);
      if (res.status === 200 && res.data) {
        const { succeeded, failed } = res.data;
        setSuccessMessage(
          failed > 0
            ? `Deleted ${succeeded} agent(s); ${failed} could not be removed.`
            : `Deleted ${succeeded} agent(s).`
        );
        setShowSuccessModal(true);
        clearRowSelection();
        fetchTestAgents();
      }
    } catch (e) {
      console.error(e);
      setSuccessMessage(e.response?.data?.error || e.message || 'Bulk delete failed');
      setShowSuccessModal(true);
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  const handleAgentStop = async (agent) => {
    if (!agent?.test_agent_id) return;
    try {
      await stopTestAgent(agent.test_agent_id);
      setSuccessMessage(`Stop requested for ${agent.name}`);
      setShowSuccessModal(true);
      fetchTestAgents();
      setTimeout(() => setShowSuccessModal(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAgentClick = useCallback(() => {
    // navigate('/showTestAgentdetails'); /**todo */
  }, []);

  const columns = useMemo(
    () => [
      {
        id: 'select',
        Header: () => (
          <Form.Check
            type="checkbox"
            aria-label="select all visible"
            checked={allFilteredSelected}
            onChange={(e) => {
              if (e.target.checked) selectAllFiltered();
              else clearRowSelection();
            }}
          />
        ),
        disableSortBy: true,
        Cell: ({ row }) => (
          <Form.Check
            type="checkbox"
            aria-label="select row"
            checked={selectedRowIds.has(row.original.test_agent_id)}
            onChange={() => toggleRowSelected(row.original.test_agent_id)}
          />
        )
      },
      {
        Header: 'Test Agent',
        accessor: 'name',
        Cell: ({ value, row }) => (
          <button type="button" className="fw-bold project-link" onClick={() => handleAgentClick(row.original)}>
            {value}
          </button>
        )
      },
      {
        Header: 'Agent Type',
        accessor: 'type',
        Cell: ({ value }) => <span className="header-text">{value}</span>
      },
      {
        Header: 'Supported Modes',
        accessor: 'supported_execution_modes',
        Cell: ({ value }) => (
          <span className="header-text text-wrap d-block" style={{ wordBreak: 'break-word' }}>
            {value && String(value).length ? String(value).split(',').join(', ') : '—'}
          </span>
        )
      },
      {
        Header: 'Host',
        accessor: 'host_ip',
        Cell: ({ value }) => <span className="header-text">{value}</span>
      },
      {
        Header: 'Created Date',
        accessor: 'created_date',
        Cell: ({ value }) => <span className="header-text">{value}</span>
      },
      {
        Header: 'Status',
        accessor: 'status',
        Cell: ({ value }) => {
          const color = testAgentStatusColorMap[value] || 'secondary';
          return <span className={`badge bg-${color}`}>{value}</span>;
        }
      },
      {
        Header: 'Actions',
        accessor: 'action',
        disableSortBy: true
      }
    ],
    [
      allFilteredSelected,
      selectedRowIds,
      selectAllFiltered,
      clearRowSelection,
      toggleRowSelected,
      handleAgentClick
    ]
  );

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

  const tableRows = filteredData.map((agent) => ({
    ...agent,
    action: (
      <ActionButtons
        agent={agent}
        onMapping={handleOpenMapping}
        onStop={handleAgentStop}
        onDelete={handleSingleDeletePrep}
      />
    )
  }));

  return (
    <div>
      {isLoading && (
        <div className="spinner-overlay">
          <Spinner animation="border" variant="primary" role="status" />
        </div>
      )}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h5 className="fw-bold">Test Agents</h5>
        <div className="d-flex flex-wrap gap-2">
          <Button variant="outline-primary" size="sm" disabled={!selectedAgents.length} onClick={handleOpenBulkMapping}>
            Map selected to projects ({selectedAgents.length})
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            disabled={!selectedAllDead}
            title={!selectedAgents.length ? 'Select agents' : selectedAllDead ? '' : 'Only agents with status DEAD can be deleted'}
            onClick={() => selectedAllDead && setBulkDeleteOpen(true)}
          >
            Delete selected ({selectedAgents.length})
          </Button>
        </div>
      </div>

      <div>
        <Row className="mb-3 align-items-center">
          <Col md={3}>
            <div className="input-group">
              <Form.Control
                type="search"
                placeholder="Search Agent"
                value={searchTerm}
                className="search-input"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="input-group-text bg-white">
                <i className="feather icon-search light-icon" />
              </span>
            </div>
          </Col>

          <Col md={2}>
            <Select
              classNamePrefix="select"
              name="status"
              options={testAgentSortOptions}
              value={statusFilter}
              onChange={(selectedOption) => {
                setStatusFilter(selectedOption);
              }}
              className="bg-white"
              placeholder="Filter by Status"
              menuPortalTarget={document.body}
              styles={selectStyles}
            />
          </Col>
        </Row>

        <div className="scroll-container scroll-70vh">
          <Table columns={columns} data={tableRows} />
        </div>
      </div>

      <ConfirmDeleteModal
        show={isConfirmDeleteOpen}
        onHide={hideConfirmDeleteModal}
        onSubmit={handleAgentDelete}
        toDelete={selectedTestAgent.name}
      />
      <ConfirmDeleteModal
        show={isBulkDeleteOpen}
        onHide={() => setBulkDeleteOpen(false)}
        onSubmit={handleBulkDelete}
        message={`Delete ${selectedAgents.length} selected test agent(s)? This cannot be undone.`}
      />
      <SuccessModal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} message={successMessage} />
      <ProjectMappingModal
        show={showMappingModal}
        onHide={() => {
          setShowMappingModal(false);
          setMappingModalAgents([]);
        }}
        agents={mappingModalAgents}
        afterSuccess={handleMappingSuccess}
      />
    </div>
  );
};

export default List;
