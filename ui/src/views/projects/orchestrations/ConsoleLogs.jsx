import React, { useRef, useEffect, useState } from 'react';
import { Card } from 'react-bootstrap';
import Select from 'react-select';
import { getConsoleLogs } from 'utils/apiServices';

const ConsoleLogs = ({ orchestrationExecution }) => {
  const scrollRef = useRef(null);

  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!orchestrationExecution) return;
      setIsLoading(true);
      try {
        let filters = {};
        if (selectedAgents.length > 0) {
          filters['agent.name'] = selectedAgents.join(',');
        }
        const response = await getConsoleLogs(orchestrationExecution.orchestration_execution_id, filters);
        if (response.status === 200) {
          setLogs(response.data?.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch console logs', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();

    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [orchestrationExecution]);

  const handleAgentSelections = (agents) => {
    setSelectedAgents(agents);
    // clearInterval(intervalId);
    // setIntervalId(0);
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="text-primary">Console Logs - {orchestrationExecution.orchestration_execution_id}</h6>
        <Select
          isMulti={true}
          options={orchestrationExecution.test_agents?.split().map((agent) => {
            return {
              value: agent,
              label: agent
            };
          })}
          placeholder="Select Agent"
          onChange={(selected) => handleAgentSelections(selected.map((option) => option.value))}
        />
      </div>

      <Card ref={scrollRef} style={{ height: '55vh', maxHeight: '60vh', overflowY: 'auto' }}>
        <Card.Body className="logs-container">
          <div>{logs != undefined && Object.entries(logs).map(([key, value]) => <div dangerouslySetInnerHTML={{ __html: value }} />)}</div>
        </Card.Body>
      </Card>
    </>
  );
};

export default ConsoleLogs;
