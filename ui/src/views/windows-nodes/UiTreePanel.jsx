import React, { useMemo, useState } from 'react';
import { Form, Table } from 'react-bootstrap';
import { flattenUiTree, formatValue } from './windowsNodesLogic';

const UiTreePanel = ({ tree }) => {
  const [query, setQuery] = useState('');
  const elements = useMemo(() => flattenUiTree(tree, query), [tree, query]);

  return (
    <section>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0">UI tree</h6>
        <Form.Control
          aria-label="Search UI tree"
          className="w-auto"
          placeholder="Search name, type, AutomationId"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="table-responsive">
        <Table hover size="sm" className="custom-cyfast-table">
          <thead>
            <tr>
              <th>Element</th>
              <th>AutomationId / class</th>
              <th>Bounds</th>
              <th>State</th>
              <th>Actions / selector</th>
              <th>Stability</th>
            </tr>
          </thead>
          <tbody>
            {elements.length ? (
              elements.map((element, index) => (
                <tr key={`${element.automationId || element.name || 'element'}-${index}`}>
                  <td style={{ paddingLeft: `${12 + element.depth * 16}px` }}>
                    <strong>{formatValue(element.name)}</strong>
                    <br />
                    <small>{formatValue(element.controlType)}</small>
                  </td>
                  <td>
                    {formatValue(element.automationId)}
                    <br />
                    <small>{formatValue(element.className)}</small>
                  </td>
                  <td>{formatValue(element.bounds)}</td>
                  <td>{element.enabled === false ? 'Disabled' : 'Enabled'}</td>
                  <td>
                    <small>
                      {formatValue(element.actions)}
                      <br />
                      {formatValue(element.selectorCandidates || element.selector)}
                    </small>
                  </td>
                  <td>{formatValue(element.stabilityScore)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-muted">
                  Inspect a running application to load the UI tree.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </section>
  );
};

export default UiTreePanel;
