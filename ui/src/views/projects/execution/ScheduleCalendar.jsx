import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card } from 'react-bootstrap';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interaction from '@fullcalendar/interaction';
import timeGrid from '@fullcalendar/timegrid';
import ProjectHeader from '../ProjectHeader';
import Spinner from 'react-bootstrap/Spinner';
import { getProjectById, getProjectExecutionStats } from 'utils/apiServices';

import { useSelectedProject } from 'contexts/ProjectContext';

ChartJS.register(ArcElement, Tooltip, Legend);

const randomDate = () => {
  const date = new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const ScheduleCalendar = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState({});
  const [executionStats, setExecutionStats] = useState({});

  const { selectedProjectInContext, setSelectedProjectInContext } = useSelectedProject();
  const project = selectedProjectInContext;
  const navigate = useNavigate();

  const event = [
    {
      title: 'All Day Event',
      start: randomDate(),
      borderColor: '#04a9f5',
      backgroundColor: '#04a9f5',
      textColor: '#fff'
    },
    {
      title: 'Long Event',
      start: randomDate(),
      end: randomDate(),
      borderColor: '#f44236',
      backgroundColor: '#f44236',
      textColor: '#fff'
    },
    {
      id: 999,
      title: 'Repeating Event',
      start: randomDate(),
      borderColor: '#f4c22b',
      backgroundColor: '#f4c22b',
      textColor: '#fff'
    },
    {
      id: 999,
      title: 'Repeating Event',
      start: randomDate(),
      borderColor: '#3ebfea',
      backgroundColor: '#3ebfea',
      textColor: '#fff'
    },
    {
      title: 'Conference',
      start: randomDate(),
      end: randomDate(),
      borderColor: '#1de9b6',
      backgroundColor: '#1de9b6',
      textColor: '#fff'
    },
    {
      title: 'Meeting',
      start: randomDate(),
      end: randomDate()
    },
    {
      title: 'Lunch',
      start: randomDate(),
      borderColor: '#f44236',
      backgroundColor: '#f44236',
      textColor: '#fff'
    },
    {
      title: 'Happy Hour',
      start: randomDate(),
      borderColor: '#a389d4',
      backgroundColor: '#a389d4',
      textColor: '#fff'
    },
    {
      title: 'Birthday Party',
      start: randomDate()
    },
    {
      title: 'Click for Google',
      url: 'http://google.com/',
      start: randomDate(),
      borderColor: '#a389d4',
      backgroundColor: '#a389d4',
      textColor: '#fff'
    }
  ];
  const head = {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  };

  const fetchProjectDetails = async () => {
    try {
      setIsLoading(true);
      const response = await getProjectById(project.project_id);
      if (response.status == 200) {
        setSelectedProject(response.data);
      } else {
        console.error('Error occured while fetching project details');
      }
    } catch (err) {
      console.error('Error fetching project details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // getProjectById api call
  useEffect(() => {
    if (!project) return;

    fetchProjectDetails();
  }, [project]);

  return (
    <div className="container-fluid p-1 container-root">
      {isLoading && (
        <div className="spinner-overlay">
          <Spinner animation="border" variant="primary" role="status"></Spinner>
        </div>
      )}

      <ProjectHeader project={project} breadcrumbs="details" />

      <Card>
        <Card.Body className="calendar">
          <div className="section-title">Schedule Calendar</div>
          <FullCalendar
            defaultView="dayGridMonth"
            header={head}
            editable={true}
            defaultDate={randomDate()}
            droppable={true}
            events={event}
            plugins={[dayGridPlugin, interaction, timeGrid]}
          />
        </Card.Body>
      </Card>
    </div>
  );
};

export default ScheduleCalendar;
