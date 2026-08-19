import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Tab, Nav } from 'react-bootstrap';
import { getExecutionLogs, downloadExecutionLogs } from 'utils/apiServices';
//import { getConsoleLogsByOrchestrationId } from 'utils/apiServices';

const ExecutionLogs = ({ orchestrationExecution }) => {
  const [scripts, setScripts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScript, setSelectedScript] = useState('');
  const [currentScript, setCurrentScript] = useState('');
  const [iframeLoading, setIframeLoading] = useState(false);

  const fetchExecutionLogs = async () => {
    if (!orchestrationExecution || !orchestrationExecution.orchestration_execution_id) return;
    try {
      const response = await getExecutionLogs(orchestrationExecution.orchestration_execution_id);
      if (response.status === 200) {
        let res = response.data;
        const uniqueScripts = [
          ...new Set(
            res.filter((item) => item.file_extension === '.html' && !item.file_name.includes('_report.')).map((item) => item.file_name)
          )
        ];
        setScripts(uniqueScripts);
      } else {
        console.error('Failed to fetch execution logs', error);
      }
    } catch (error) {
      console.error('Error occured while fetching execution logs', error);
    }
  };

  useEffect(() => {
    fetchExecutionLogs();
  }, [orchestrationExecution]);

  const hideLoading = () => {
    setIframeLoading(false);
  };

  const handleScriptSelect = (fileName) => {
    if (currentScript != fileName) {
      setIframeLoading(true);
      setCurrentScript(fileName);
    }

    setSelectedScript(
      import.meta.env.VITE_CYFAST_LOGS_API_URL +
        'logs/execution/orchestration_execution/' +
        orchestrationExecution.orchestration_execution_id +
        '/reports/' +
        fileName
    );
  };

  const handleDownloadLogs = async () => {
    try {
      const response = await downloadExecutionLogs(orchestrationExecution?.orchestration_execution_id);
      if (response.status === 200 && response.data) {
        const url = window.URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = orchestrationExecution?.orchestration_execution_id + '_reports.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Failed to download reports for ' + orchestrationExecution?.orchestration_execution_id);
      }
    } catch (error) {
      console.error('Error occured while downloading reports', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="text-primary">Execution Reports - {orchestrationExecution?.orchestration_execution_id}</h6>
        <Button variant="secondary" onClick={handleDownloadLogs} disabled={!orchestrationExecution || scripts.length == 0}>
          Download All
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Body>
          {(!scripts || scripts.length === 0) && <div>No execution reports found.</div>}
          {scripts && scripts.length > 0 && (
            <Tab.Container defaultActiveKey="gn">
              <Row>
                <Col sm={3}>
                  <Nav variant="pills" className="flex-column">
                    {scripts.map((script, index) => (
                      <Nav.Item className="mb-2">
                        <Nav.Link eventKey="gn" onClick={() => handleScriptSelect(script)}>
                          <div title={script} style={{ maxWidth: '230px', overflow: 'hidden' }}>
                            {script}
                          </div>
                        </Nav.Link>
                      </Nav.Item>
                    ))}
                  </Nav>
                </Col>
                <Col sm={9}>
                  <Tab.Content>
                    <Tab.Pane eventKey="gn">
                      <div className="execution-log-container">
                        {iframeLoading ? (
                          <div
                            style={{
                              textAlign: 'center',
                              position: 'absolute',
                              left: '0px',
                              top: '0px',
                              height: '450px',
                              width: '100%',
                              paddingTop: '150px',
                              background: 'rgba(200,200,200,.4)'
                            }}
                          >
                            Loading...
                          </div>
                        ) : (
                          ''
                        )}
                        <iframe
                          title={selectedScript}
                          src={selectedScript}
                          className="col-sm-12 col-md-12 col-lg-12"
                          style={{ height: '100%' }}
                          onLoad={hideLoading}
                        />
                      </div>
                    </Tab.Pane>
                  </Tab.Content>
                </Col>
              </Row>
            </Tab.Container>
          )}
        </Card.Body>
      </Card>
    </>
  );
};

export default ExecutionLogs;
