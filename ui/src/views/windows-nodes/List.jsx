import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Spinner, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { listWindowsNodes } from 'utils/windowsApi';
import { asArray, formatValue, mapError } from './windowsNodesLogic';

const List = () => {
  const [nodes, setNodes] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = async () => {
    setLoading(true);
    try {
      const response = await listWindowsNodes();
      setNodes(asArray(response.data));
      setError(null);
    } catch (requestError) {
      setError(mapError(requestError));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  const filtered = useMemo(() => nodes.filter((node) => JSON.stringify(node).toLowerCase().includes(query.toLowerCase())), [nodes, query]);
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold">Windows Nodes</h5>
        <Button size="sm" variant="outline-primary" onClick={load}>
          Refresh
        </Button>
      </div>
      {error && (
        <div className="alert alert-danger">
          <strong>{error.code}:</strong> {error.message}
        </div>
      )}
      <div className="mb-3">
        <Form.Control type="search" placeholder="Search nodes" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {loading ? (
        <Spinner animation="border" />
      ) : (
        <div className="table-responsive">
          <Table hover className="custom-cyfast-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>OS / architecture</th>
                <th>Agent version</th>
                <th>Interactive session</th>
                <th>Last heartbeat</th>
                <th>Capabilities</th>
                <th>Project</th>
                <th>Activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((node) => (
                  <tr key={node.windows_node_id}>
                    <td>
                      <Link className="fw-bold project-link" to={`/resources/windows-nodes/${node.windows_node_id}`}>
                        {formatValue(node.name)}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge bg-${String(node.status).toUpperCase() === 'ONLINE' ? 'success' : 'secondary'}`}>
                        {formatValue(node.status)}
                      </span>
                    </td>
                    <td>
                      {formatValue(node.os || node.metadata?.os)}
                      <br />
                      <small>{formatValue(node.architecture || node.metadata?.architecture)}</small>
                    </td>
                    <td>{formatValue(node.agent_version || node.metadata?.agent_version)}</td>
                    <td>{formatValue(node.interactive_session_status || node.metadata?.interactive_session_status)}</td>
                    <td>{formatValue(node.last_seen_at || node.last_heartbeat_at)}</td>
                    <td>{Array.isArray(node.capabilities) ? node.capabilities.join(', ') : formatValue(node.capabilities)}</td>
                    <td>{formatValue(node.project_name || node.project_id)}</td>
                    <td>{formatValue(node.activity || node.metadata?.activity)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-muted">
                    No Windows nodes found.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
};
export default List;
