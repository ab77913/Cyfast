import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Modal, Row, Col, Form, ToggleButtonGroup, ToggleButton, Dropdown } from 'react-bootstrap';
import { Stepper } from 'react-dynamic-stepper';
import { FiMoreVertical } from 'react-icons/fi';
import { runOrderOptions, triggerCriteriaOptions, executionBaseOptions } from 'data/listData';
import { useSelectedProject } from 'contexts/ProjectContext';
import {
  getTestSuitesByProjectId,
  getTestScriptsByProjectIdAndTestSuiteId,
  getTestCasesByProjectIdAndTestSuiteId,
  getOrchestration
} from 'utils/apiServices';
import SuccessModal from 'views/shared-modals/SuccessModal';
import Spinner from 'react-bootstrap/Spinner';
import DatePicker from 'react-datepicker';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const OrchestrationFormModal = ({ show, onClose, onSubmit, modalTitle, editOrchestrationId }) => {
  const { selectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;

  const [suites, setSuites] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [cases, setCases] = useState([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState(null);
  const [noSuitesFound, setNoSuitesFound] = useState(false);
  const [fetchedOrchestration, setFetchedOrchestration] = useState(null);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [removedTestCaseIds, setRemovedTestCaseIds] = useState(new Set());
  const stepperRef = useRef(null);
  const [step1Touched, setStep1Touched] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [suiteSourceType, setSuiteSourceType] = useState('');

  // for Setp 2 : select test cases:
  //for left column
  const [selectedSuite, setSelectedSuite] = useState('');
  const [step2Touched, setStep2Touched] = useState(false);

  // for middle column
  const [selectedTestCases, setSelectedTestCases] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [searchTestScripts, setSearchTestScripts] = useState('');
  //const [searchTestScript, setSearchTestScript] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [currentStepData, setCurrentStepData] = useState({
    orchestrationName: '',
    runType: 'sequential',
    triggerCriteria: 'ondemand',
    onError: 'continue',
    executionBase: 'testScript',
    scheduleStart: null,
    scheduleEnd: null,
    scheduleInterval: '',
    repeatEvery: '',
    repeatUnit: '',
    endAfterOccurrences: ''
  });

  useEffect(() => {
    if (show) {
      setHasLoadedInitialData(false);
      setSelectedTestCases([]);
      setRemovedTestCaseIds(new Set());
    }
  }, [show]);

  // getTestSuitesByProjectId for Add Orchestration
  useEffect(() => {
    if (!project || !show) return;

    const fetchTestSuites = async () => {
      try {
        const response = await getTestSuitesByProjectId(project.project_id);
        //console.log('getTestSuitesByProjectId ', response);
        if (response.status === 200) {
          const suitesData = response.data.data;
          setSuites(suitesData);
          setNoSuitesFound(suitesData.length === 0);
        }
      } catch (error) {
        console.error('Error fetching getTestSuitesByProjectId :', error);
      }
    };

    fetchTestSuites();
  }, [project, show]);

  // getTestScriptsByProjectIdAndTestSuiteId and getTestCasesByProjectIdAndTestSuiteId api calls for add Orchestrations
  useEffect(() => {
    if (!project || !selectedSuiteId || !show) return;

    const loadTestScriptData = async () => {
      try {
        const pagingAll = { page: 1, size: 200 };
        const [testScriptResp, testCaseResp] = await Promise.all([
          getTestScriptsByProjectIdAndTestSuiteId(project.project_id, selectedSuiteId, pagingAll),
          getTestCasesByProjectIdAndTestSuiteId(project.project_id, selectedSuiteId, pagingAll)
        ]);
        setScripts(testScriptResp.data.data);
        setCases(testCaseResp.data.data);
      } catch (error) {
        console.error(error);
      }
    };
    if (selectedSuiteId) loadTestScriptData();
  }, [project, selectedSuiteId, show]);

  // to populate data for existing Orchestation (to edit/update) from api call
  useEffect(() => {
    const fetchOrchestrationData = async () => {
      if (!project || !editOrchestrationId || !show || hasLoadedInitialData) return;

      try {
        setIsLoading(true);
        const response = await getOrchestration(editOrchestrationId);
        if (response.status === 200) {
          const data = response.data;
          const config = data.configuration;

          // Populate form values
          setCurrentStepData({
            orchestrationName: data.name,
            runType: (() => {
              switch (config.run_order) {
                case 'SEQUENTIAL':
                  return 'sequential';
                case 'PARALLEL':
                  return 'parallel';
                case 'DISTRIBUTED':
                  return 'distributed';
                case 'SEQUENTIAL_DEPENDENCY':
                  return 'sequentialdependency';
                default:
                  return 'parallel';
              }
            })(),

            triggerCriteria: (() => {
              switch (config.trigger_criteria) {
                case 'ON_DEMAND':
                  return 'ondemand';
                case 'ON_EVENT':
                  return 'onevent';
                case 'PERIODICALLY':
                  return 'periodically';
                default:
                  return 'ondemand';
              }
            })(),
            onError: config.continue_on_error ? 'continue' : 'abort',
            executionBase: config.execution_base === 'TEST_CASE' ? 'testCase' : 'testScript'
          });
          setFetchedOrchestration(data);
          // // set Suite selection
          // setSelectedSuiteId(data.test_suite_id || '1');
          // setSelectedSuite(data.test_suite_id || '1');
          setSelectedSuiteId(1); //todo: remove value 1 once api return test_suite_id
          setSelectedSuite(1);
          //  if (data.test_suite_id) {
          //     setSelectedSuiteId(data.test_suite_id);
          //   setSelectedSuite(data.test_suite_id);
          //   }
          setStep1Touched(false);
          setStep2Touched(false);
          setCurrentStep(0);
          stepperRef.current?.navigateToStep(0); // show first stepper after populating all data on modal
          setHasLoadedInitialData(true);
        }
      } catch (err) {
        console.error('Error fetching orchestration:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrchestrationData();
  }, [editOrchestrationId, project, show, hasLoadedInitialData]);

  // after loading scripts & cases
  useEffect(() => {
    if (hasLoadedInitialData) {
      initializeSelectedCases();
    }
  }, [scripts, cases]);

  useEffect(() => {
    setRemovedTestCaseIds(new Set());
  }, [fetchedOrchestration?.id]);

  // mapping/grouping test scripts with test cases...
  const testScriptsWithTestCases = useMemo(() => {
    const map = scripts.reduce((acc, s) => {
      acc[s.test_script_id] = { ...s, cases: [] };
      return acc;
    }, {});
    cases.forEach((tc) => {
      if (map[tc.test_script_id]) {
        map[tc.test_script_id].cases.push(tc);
      }
    });
    return Object.values(map);
  }, [scripts, cases]);

  const initializeSelectedCases = () => {
    if (!fetchedOrchestration || !Array.isArray(fetchedOrchestration.tests) || scripts.length === 0 || cases.length === 0) {
      return;
    }

    const mappedCases = fetchedOrchestration.tests
      .filter((tc) => !removedTestCaseIds.has(tc.test_case_id))
      .map((tc) => {
        const script = scripts.find((s) => s.test_script_id === tc.test_script_id);
        const testCase = cases.find((c) => c.test_case_id === tc.test_case_id);
        if (!testCase || !script) {
          return null;
        }
        return {
          test_case_id: tc.test_case_id,
          test_case_no: testCase?.test_case_no || '',
          name: testCase?.name || '',
          version: testCase?.version,
          environment: testCase?.environment,
          scriptId: tc.test_script_id,
          scriptName: script?.name || ''
        };
      })
      .filter(Boolean);

    // Merging new testCases with previous selectedTestCases, no duplicates
    setSelectedTestCases((prevSelected) => {
      const cleanedPrev = prevSelected.filter((tc) => tc.test_case_no && tc.name);
      const existingIds = new Set(cleanedPrev.map((tc) => tc.test_case_id));
      const newUniqueCases = mappedCases.filter((tc) => !existingIds.has(tc.test_case_id));
      return [...cleanedPrev, ...newUniqueCases];
    });
  };

  const InfoMessage = ({ message }) => <div className="alert alert-info text-center my-3">{message}</div>;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentStepData((prev) => ({ ...prev, [name]: value }));
    setStep1Touched(true);
  };

  const handleToggleChange = (name, value) => {
    setCurrentStepData((prev) => ({ ...prev, [name]: value }));
    setStep1Touched(true);
  };

  // Validating the Step 1: all fields are required and non-empty
  const isStep1Complete = () => {
    const data = currentStepData;

    if (!data.orchestrationName?.trim() || !data.runType || !data.triggerCriteria || !data.onError || !data.executionBase) {
      return false;
    }

    if (data.triggerCriteria === 'periodically') {
      if (!data.scheduleStart) return false;
      if (!data.repeatEvery || isNaN(Number(data.repeatEvery))) return false;
      if (!data.repeatUnit) return false;

      if (!data.scheduleEnd && !data.endAfterOccurrences) return false;
    }

    return true;
  };

  // validating step 2.
  const isStep2Complete = () => {
    return selectedTestCases.length > 0;
  };

  const handleReset = () => {
    // Reset all states to initial values
    setCurrentStepData({
      orchestrationName: '',
      runType: 'parallel',
      triggerCriteria: 'ondemand',
      onError: 'continue',
      executionBase: 'testScript'
    });
    setSuiteSourceType('');
    setSelectedSuite('');
    setSelectedSuiteId(null);
    setScripts([]);
    setSelectedTestCases([]);
    setExpandedProjects({});
    setSearchTestScripts('');
    //setSearchTestScript('');
    setStep1Touched(false);
    setStep2Touched(false);
    setCurrentStep(0);

    // Reset the stepper navigation to first step
    stepperRef.current?.navigateToStep(0);

    // Close orchestration modal
    onClose();
  };

  //Submit action
  const submitStepper = () => {
    console.log('Final Form Submission Data:', currentStepData, selectedTestCases, selectedSuite);
    if (typeof onSubmit === 'function') {
      onSubmit(currentStepData, selectedTestCases, selectedSuite);
    }
    handleReset();
  };

  const handleCancel = () => {
    handleReset();
  };

  // Code for setp 2: Select Test cases : Middle Column::
  //Toggle expand/collapse
  const toggleExpand = (testScriptId) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [testScriptId]: !prev[testScriptId]
    }));
  };

  // Handle parent checkbox (select/deselect all children)
  const handleParentCheckboxChange = (scriptId, isChecked) => {
    const scriptEntry = testScriptsWithTestCases.find((s) => s.test_script_id === scriptId);
    const testCases = scriptEntry ? scriptEntry.cases : [];
    const scriptName = scripts.find((s) => s.test_script_id === scriptId)?.name;

    setSelectedTestCases((prev) => {
      if (isChecked) {
        const newSelections = testCases
          .map((tc) => ({
            test_case_id: tc.test_case_id,
            test_case_no: tc.test_case_no,
            name: tc.name,
            version: tc.version,
            environment: tc.environment,
            scriptId,
            scriptName
          }))
          .filter((tc) => !prev.some((p) => p.test_case_id === tc.test_case_id && p.scriptId === scriptId));
        return [...prev, ...newSelections];
      } else {
        return prev.filter((tc) => tc.scriptId !== scriptId);
      }
    });

    setRemovedTestCaseIds((prevSet) => {
      const newSet = new Set(prevSet);
      if (isChecked) {
        testCases.forEach((tc) => newSet.delete(tc.test_case_id));
      } else {
        testCases.forEach((tc) => newSet.add(tc.test_case_id));
      }
      return newSet;
    });
  };

  // Handle individual checkbox
  const handleTestCaseSelection = (scriptId, testCase, isChecked) => {
    setRemovedTestCaseIds((prevSet) => {
      const newSet = new Set(prevSet);
      if (isChecked) {
        newSet.delete(testCase.test_case_id);
      } else {
        newSet.add(testCase.test_case_id);
      }
      return newSet;
    });

    setSelectedTestCases((prev) => {
      if (isChecked) {
        if (!prev.some((tc) => tc.test_case_id === testCase.test_case_id && tc.scriptId === scriptId)) {
          return [
            ...prev,
            {
              test_case_id: testCase.test_case_id,
              test_case_no: testCase.test_case_no,
              name: testCase.name,
              version: testCase.version,
              environment: testCase.environment,
              scriptId,
              scriptName: scripts.find((s) => s.test_script_id === scriptId)?.name || ''
            }
          ];
        }
        return prev;
      } else {
        return prev.filter((tc) => !(tc.test_case_id === testCase.test_case_id && tc.scriptId === scriptId));
      }
    });
  };

  const filteredScripts = useMemo(() => {
    if (!searchTestScripts.trim()) return testScriptsWithTestCases;
    const lower = searchTestScripts.toLowerCase();
    return testScriptsWithTestCases.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.cases.some((tc) => tc.name.toLowerCase().includes(lower) || tc.test_case_no.toLowerCase().includes(lower))
    );
  }, [testScriptsWithTestCases, searchTestScripts]);

  // all sub-test-cases to selected in project
  const isAllChildrenSelected = (scriptId) => {
    const scriptEntry = testScriptsWithTestCases.find((s) => s.test_script_id === scriptId);
    const testCases = scriptEntry?.cases || [];

    return testCases.every((tc) =>
      selectedTestCases.some((selected) => selected.test_case_id === tc.test_case_id && selected.scriptId === scriptId)
    );
  };

  const handleSuiteSourceChange = async (e) => {
    const selected = e.target.value;
    setSuiteSourceType(selected);
    setSuites([]);
    setSelectedSuiteId(null);
    setNoSuitesFound(false);

    if (selected === 'testSuites') {
      try {
        const response = await getTestSuitesByProjectId(project.project_id);
        const data = response.data.data;
        setSuites(data);
        setNoSuitesFound(data.length === 0);
      } catch (err) {
        console.error('Failed to fetch test suites', err);
        setNoSuitesFound(true);
      }
    }
  };

  // function to move items up/down in the list
  const moveItem = (fromIndex, toIndex) => {
    setSelectedTestCases((prev) => {
      const updated = [...prev];
      if (toIndex < 0 || toIndex >= updated.length) return updated;
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  // Steps with header style update based on validation and step index
  const steps = [
    // Step 1 UI
    {
      header: {
        label: 'Configure Orchestration'
      },
      content: (
        <div className="step-content-bordered mt-4">
          <Form>
            <div>
              {noSuitesFound && <InfoMessage message="No test suites found for the selected project." />}

              <Form.Group as={Row} className="mb-3" controlId="formOrchestrationName">
                <Form.Label column sm={2} className="orche-modal-label text-nowrap">
                  Orchestration Name <span className="text-danger">*</span>
                </Form.Label>
                <Col sm={5}>
                  <Form.Control
                    type="text"
                    placeholder="Please Enter Orchestration"
                    name="orchestrationName"
                    value={currentStepData.orchestrationName}
                    onChange={handleChange}
                    isInvalid={step1Touched && currentStepData.orchestrationName.trim() === ''}
                  />
                  <Form.Control.Feedback type="invalid">This field is required.</Form.Control.Feedback>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mt-3 align-items-center">
                <Form.Label column sm={2} className="orche-modal-label">
                  Run Type <span className="text-danger">*</span>
                </Form.Label>
                <Col sm={8}>
                  <div className="d-flex gap-5">
                    {['Sequential', 'Parallel', 'Distributed', 'Sequential Dependency'].map((type, idx) => (
                      <Form.Check
                        key={idx}
                        type="radio"
                        label={type}
                        name="runType"
                        id={`runType-${type}`}
                        value={type.toLowerCase().replace(/\s/g, '')}
                        checked={currentStepData.runType === type.toLowerCase().replace(/\s/g, '')}
                        onChange={(e) => handleToggleChange('runType', e.target.value)}
                        style={{ color: '#75787B' }}
                        // inputProps={{ style: { transform: 'scale(1.5)' } }}
                        className="large-radio"
                      />
                    ))}
                  </div>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mt-3 align-items-center">
                <Form.Label column sm={2} className="orche-modal-label">
                  Trigger Criteria <span className="text-danger">*</span>
                </Form.Label>
                <Col sm={8}>
                  <div className="d-flex gap-5">
                    {['On Demand', 'Periodically', 'On Event'].map((type, idx) => (
                      <Form.Check
                        key={idx}
                        type="radio"
                        label={type}
                        name="triggerCriteria"
                        id={`triggerCriteria-${type}`}
                        value={type.toLowerCase().replace(/\s/g, '')}
                        checked={currentStepData.triggerCriteria === type.toLowerCase().replace(/\s/g, '')}
                        onChange={(e) => handleToggleChange('triggerCriteria', e.target.value)}
                        style={{ color: '#75787B' }}
                        className="large-radio"
                      />
                    ))}
                  </div>
                </Col>

                {currentStepData.triggerCriteria === 'periodically' && (
                  <div className="mt-3 p-3 border rounded bg-light">
                    <div className="d-flex align-items-center mb-3">
                      <Form.Label column sm={2} className="orche-modal-label">
                        Start Date
                      </Form.Label>

                      <DatePicker
                        selected={currentStepData.scheduleStart}
                        onChange={(date) => setCurrentStepData((prev) => ({ ...prev, scheduleStart: date }))}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="dd/MM/yyyy HH:mm"
                        className="form-control ms-2"
                        placeholderText="Select start date"
                        todayButton="Today"
                        withPortal
                        style={{ flex: 1 }}
                      />
                    </div>

                    <div className="d-flex align-items-center mb-3 gap-2">
                      <Form.Label column sm={2} className="orche-modal-label">
                        Repeat every
                      </Form.Label>

                      <input
                        type="number"
                        min={1}
                        className="form-control"
                        style={{ width: '120px' }}
                        value={currentStepData.repeatEvery || ''}
                        onChange={(e) => setCurrentStepData((prev) => ({ ...prev, repeatEvery: e.target.value }))}
                      />
                      <select
                        className="form-select"
                        style={{ width: '150px' }}
                        value={currentStepData.repeatUnit || ''}
                        onChange={(e) => setCurrentStepData((prev) => ({ ...prev, repeatUnit: e.target.value }))}
                      >
                        <option value="">Select</option>
                        <option value="day">Day</option>
                        <option value="hour">Hour</option>
                        <option value="month">Month</option>
                      </select>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <Form.Label column sm={2} className="orche-modal-label">
                        End Date
                      </Form.Label>

                      <DatePicker
                        selected={currentStepData.scheduleEnd}
                        onChange={(date) => setCurrentStepData((prev) => ({ ...prev, scheduleEnd: date }))}
                        showTimeSelect
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="dd/MM/yyyy HH:mm"
                        className="form-control"
                        placeholderText="Select end date"
                        todayButton="Today"
                        withPortal
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number"
                        min={1}
                        className="form-control"
                        placeholder="Occurrences"
                        style={{ width: '150px' }}
                        value={currentStepData.endAfterOccurrences || ''}
                        onChange={(e) => setCurrentStepData((prev) => ({ ...prev, endAfterOccurrences: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </Form.Group>

              <Form.Group as={Row} className="mt-3 align-items-center">
                <Form.Label column sm={2} className="orche-modal-label">
                  On Error <span className="text-danger">*</span>
                </Form.Label>
                <Col sm={8}>
                  <ToggleButtonGroup
                    type="radio"
                    name="onError"
                    value={currentStepData.onError}
                    onChange={(val) => handleToggleChange('onError', val)}
                  >
                    <ToggleButton
                      id="onError-continue"
                      value="continue"
                      variant={currentStepData.onError === 'continue' ? 'secondary' : 'outline-secondary'}
                    >
                      Continue
                    </ToggleButton>
                    <ToggleButton
                      id="onError-abort"
                      value="abort"
                      variant={currentStepData.onError === 'abort' ? 'secondary' : 'outline-secondary'}
                    >
                      Abort
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Col>
              </Form.Group>

              <Form.Group as={Row} className="mt-3 align-items-center">
                <Form.Label column sm={2} className="orche-modal-label">
                  Execution Base <span className="text-danger">*</span>
                </Form.Label>
                <Col sm={8}>
                  <ToggleButtonGroup
                    type="radio"
                    name="executionBase"
                    value={currentStepData.executionBase}
                    onChange={(val) => handleToggleChange('executionBase', val)}
                  >
                    <ToggleButton
                      id="executionBase-testCase"
                      value="testCase"
                      variant={currentStepData.executionBase === 'testCase' ? 'secondary' : 'outline-secondary'}
                    >
                      Test Case
                    </ToggleButton>
                    <ToggleButton
                      id="executionBase-testScript"
                      value="testScript"
                      variant={currentStepData.executionBase === 'testScript' ? 'secondary' : 'outline-secondary'}
                    >
                      Test Script
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Col>
              </Form.Group>
            </div>
          </Form>
        </div>
      ),
      isError: !isStep1Complete() && step1Touched,
      isComplete: isStep1Complete()
    },
    // Step 2 UI
    {
      header: {
        label: 'Select Test Cases'
      },
      content: (
        <div className="step-content-bordered">
          {noSuitesFound && <InfoMessage message="No test suites found for the selected project." />}

          <Row className="gx-3 mt-4 d-flex align-items-stretch" style={{ minHeight: '285px' }}>
            {/* Left Column */}
            <Col sm={3} className="d-flex flex-column">
              <div className="step-two-test-block">
                <Form.Group controlId="testSuiteSelect">
                  <Form.Select
                    value={suiteSourceType}
                    onChange={handleSuiteSourceChange}
                    aria-label="Select Suite"
                    className="step-two-list"
                  >
                    <option value="" disabled>
                      Select Source
                    </option>
                    <option value="testSuites">Test Suites</option>
                    <option value="requirements">Requirements</option>
                    <option value="risks">Risks</option>
                  </Form.Select>
                </Form.Group>

                {suiteSourceType === 'testSuites' && (
                  <>
                    {noSuitesFound ? (
                      <div className="mt-3 placeholder-message">No suites found.</div>
                    ) : suites.length === 0 ? (
                      <div className="mt-3 placeholder-message">Loading suites...</div>
                    ) : !selectedSuiteId ? (
                      <div className="mt-3 placeholder-message">Please select a suite to get started</div>
                    ) : null}

                    <div className="suite-list">
                      {suites.map((suite, index) => (
                        <React.Fragment key={suite.test_suite_id}>
                          <div
                            className={`suite-item ${selectedSuiteId === suite.test_suite_id ? 'selected' : ''}`}
                            onClick={() => setSelectedSuiteId(suite.test_suite_id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                setSelectedSuiteId(suite.test_suite_id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selectedSuiteId === suite.test_suite_id}
                          >
                            {suite.name}
                          </div>
                          {index !== suites.length - 1 && <hr className="suite-item-divider" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </>
                )}
                {suiteSourceType === 'requirements' && <div className="mt-3 placeholder-message">N/A</div>}

                {suiteSourceType === 'risks' && <div className="mt-3 placeholder-message">N/A</div>}
              </div>
            </Col>

            {/* Middle Column */}
            <Col sm={6} className="d-flex flex-column">
              <div className="step-two-middle">
                <div className="input-group mb-2">
                  <Form.Control
                    type="search"
                    placeholder="Search by Test Script"
                    value={searchTestScripts}
                    className="search-input"
                    onChange={(e) => setSearchTestScripts(e.target.value)}
                  />
                  <span className="input-group-text bg-white">
                    <i className="feather icon-search light-icon" />
                  </span>
                </div>

                {filteredScripts.map((script) => (
                  <div key={script.test_script_id} className="step-two-suites">
                    {/* Project Header */}
                    <div className="step-two-prjheader">
                      {/* Left: Chevron + Project Name */}
                      <div className="chevron-style">
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
                        <span style={{ cursor: 'pointer' }} onClick={() => toggleExpand(script.test_script_id)}>
                          {expandedProjects[script.test_script_id] ? (
                            <i className="fas fa-chevron-up" />
                          ) : (
                            <i className="fas fa-chevron-down" />
                          )}
                        </span>
                        <span>{script.name}</span>
                      </div>

                      {/* Right: Select All Checkbox */}
                      <Form.Check
                        type="checkbox"
                        id={`project-${script.test_script_id}`}
                        checked={isAllChildrenSelected(script.test_script_id)}
                        className="custom-checkbox-dark"
                        style={{ transform: 'scale(1.1)' }}
                        onChange={(e) => handleParentCheckboxChange(script.test_script_id, e.target.checked)}
                      />
                    </div>
                    {/* Test Cases */}
                    {expandedProjects[script.test_script_id] && (
                      <div className="px-3 py-2">
                        {script.cases.map((tc) => (
                          <Form.Check
                            key={tc.test_case_id}
                            type="checkbox"
                            label={`${tc.test_case_no} — ${tc.name}`}
                            checked={selectedTestCases.some(
                              (sel) => sel.test_case_id === tc.test_case_id && sel.scriptId === script.test_script_id
                            )}
                            onChange={(e) => handleTestCaseSelection(script.test_script_id, tc, e.target.checked)}
                            className="custom-checkbox-dark"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Col>

            {/* Right Column */}
            <Col sm={3} className="d-flex flex-column">
              <div className="step-two-rightcolumn">
                <div className="selected-testcases">Selected Test Cases</div>
                <div className="test-cases-list">
                  {selectedTestCases.length > 0 ? (
                    selectedTestCases.map((testCase, idx) => (
                      <div key={idx} className="step-two-list fw-semibold">
                        {testCase.test_case_no} - {testCase.name}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#999' }}>No Test Cases selected</div>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </div>
      ),
      isError: !isStep2Complete() && step2Touched,
      isComplete: isStep2Complete()
    },
    // Step 3 UI
    {
      header: {
        label: 'Sequence Test Cases'
      },
      content: (
        <div className="step-content-bordered">
          {/* Search Input */}
          <div className="input-group mb-2" style={{ width: '300px' }}>
            <Form.Control
              type="search"
              placeholder="Search by Test Script"
              value={searchTestScripts}
              onChange={(e) => setSearchTestScripts(e.target.value)}
            />
            <span className="input-group-text bg-white">
              <i className="feather icon-search light-icon" />
            </span>
          </div>

          <div className="row fw-semibold bg-light py-2 mb-1">
            <div className="col-1">SEQUENCE NO</div>
            <div className="col-3">TEST SCRIPT</div>
            <div className="col-2">TEST CASE NO</div>
            <div className="col-3">TEST CASE NAME</div>
            <div className="col-1">VERSION</div>
            <div className="col-1">ENVIRONMENT</div>
            <div className="col-1"></div> {/* for the 3‑dot menu column */}
          </div>

          {/** for Drag and Drop of an item in the list */}
          <DragDropContext
            onDragEnd={(result) => {
              if (!result.destination) return;

              const fromIndex = result.source.index;
              const toIndex = result.destination.index;

              // Reorder the selectedTestCases array
              setSelectedTestCases((prev) => {
                const updated = Array.from(prev);
                const [moved] = updated.splice(fromIndex, 1);
                updated.splice(toIndex, 0, moved);
                return updated;
              });
            }}
          >
            <Droppable droppableId="testCasesDroppable">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {selectedTestCases
                    .filter((tc) => tc.scriptName?.toLowerCase().includes(searchTestScripts.toLowerCase()))
                    //commented to reorder the test case list
                    // .sort((a, b) => {
                    //   const numA = parseInt(a.test_case_no.replace(/\D/g, ''), 10);
                    //   const numB = parseInt(b.test_case_no.replace(/\D/g, ''), 10);
                    //   return numA - numB;
                    // })
                    .map((testCase, idx) => (
                      <Draggable key={testCase.test_case_id} draggableId={`${testCase.test_case_id}`} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`row align-items-center border border-1 rounded p-2 mb-2 ${snapshot.isDragging ? 'bg-light' : ''}`}
                            style={{
                              ...provided.draggableProps.style,
                              userSelect: 'none',
                              background: snapshot.isDragging ? '#f0f0f0' : 'white'
                            }}
                          >
                            <div className="col-1">{idx + 1}</div>
                            <div className="col-3">{testCase.scriptName}</div>
                            <div className="col-2">
                              <span className="badge border border-info text-dark">{testCase.test_case_no}</span>
                            </div>
                            <div className="col-3">{testCase.name}</div>
                            <div className="col-1">{testCase.version || '-'}</div>
                            <div className="col-1">{testCase.environment || '-'}</div>
                            <div className="col-1 text-end">
                              <Dropdown align="end">
                                <Dropdown.Toggle as="span" style={{ cursor: 'pointer' }}>
                                  <FiMoreVertical size={18} color="#6c757d" />
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                  <Dropdown.Item disabled={idx === 0} onClick={() => moveItem(idx, idx - 1)}>
                                    Move Up
                                  </Dropdown.Item>
                                  <Dropdown.Item disabled={idx === selectedTestCases.length - 1} onClick={() => moveItem(idx, idx + 1)}>
                                    Move Down
                                  </Dropdown.Item>
                                </Dropdown.Menu>
                              </Dropdown>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      ),
      isError: false,
      isComplete: selectedTestCases.length > 0
    }
  ];

  return (
    <>
      <SuccessModal
        show={showSuccessModal}
        onHide={() => setShowSuccessModal(false)}
        message="Orchestration has been added successfully."
      />
      <Modal show={show} onHide={handleCancel} centered size="xl">
        <Modal.Header closeButton onClick={handleCancel}>
          <Modal.Title className="h5">{modalTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="orch-modal">
          {isLoading && (
            <div className="spinner-overlay">
              <Spinner animation="border" variant="primary" role="status"></Spinner>
            </div>
          )}
          <div className="p-2">
            <Stepper
              ref={stepperRef}
              steps={steps}
              isSequenceStepper
              activeStep={currentStep}
              onStepChange={(stepIndex) => setCurrentStep(stepIndex)}
              footerData={{
                prevBtnLabel: 'Previous',
                prevBtnClassName: 'btn btn-outline-dark',
                nextBtnLabel: 'Next',
                nextBtnClassName: 'btn btn-primary',
                submitBtnLabel: 'Submit',
                submitBtnClassName: 'btn btn-success',
                submitHandler: submitStepper
              }}
            />
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default OrchestrationFormModal;
