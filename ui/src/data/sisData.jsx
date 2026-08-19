import React from 'react';

// third party
import { Chance } from 'chance';

// project import
import { getImageURL } from 'utils/getImage';

const chance = new Chance();
const range = (len) => {
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(i);
  }
  return arr;
};

const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toDateString();
};

const GetAvatar = (name) => {
  const photo_new = 'avatar-' + Math.floor(Math.random() * 5 + 1) + '.jpg';
  return <img src={getImageURL(photo_new)} className="img-fluid img-radius wid-40" alt={name} />;
};

let i = 1;

const newPerson = () => {
  const name = chance.name();
  const status = Math.floor(Math.random() * 4 + 1);
  const description = chance.sentence({ words: 2 });
  const deadline = new Date();
  deadline.setDate(new Date().getDate() + 365);

  const subjects = [
    'Advanced Information Security',
    'Advanced Mobile Application Development',
    'Advanced RDBMS',
    'Advanced Software Engineering',
    'Big Data Analytics',
    'Collaborative Content Management Systems',
    'Information Security',
    'Mobile Application Development',
    'MVC based Web Development',
    'MVC Frameworks',
    'Open Source Web Application Development',
    'Project',
    'Search Engine Optimization',
    'Web Analytics',
    'Web Application Development using ASP.NET',
    'Web Programming'
  ];
  const subject = subjects[Math.floor(Math.random() * 15 + 0)];

  const assignments = [
    'Assignment',
    'Confirmation Letter',
    'Internal',
    'Joining Letter',
    'Journal',
    'Open Book',
    'Presentation - 1',
    'Presentation - 2',
    'Progress Report - 1',
    'Progress Report - 2',
    'Project Report',
    'Quiz',
    'Self Creation Parameter',
    'Unit Test',
    'Viva',
    'Work Progress Analysis'
  ];
  const assignment = assignments[Math.floor(Math.random() * 15 + 0)];

  const markIndex = Math.floor(Math.random() * 14 + 0);
  const totalMarks = [4, 5, 6, 10, 20, 30, 40, 50, 60, 100, 140, 150, 165, 275, 285];
  const passingMarks = [2, 3, 2, 4, 9, 13, 17, 21, 25, 35, 48, 60, 62, 115, 125];
  const totalMark = totalMarks[markIndex];
  const passingMark = passingMarks[markIndex];

  const mark = Math.floor(Math.random() * totalMarks[markIndex] + 0);

  return {
    id: i++,
    name: name,
    avatar: GetAvatar(name),
    description: description,
    email: name.toLowerCase().replace(/\s/g, '') + '@gmail.com',
    phone:
      '+9' +
      Math.floor(Math.random() * 9 + 1) +
      ' ' +
      chance.integer({ min: 100, max: 999 }) +
      '-' +
      chance.integer({ min: 100000, max: 999999 }),
    date: randomDate(new Date(2012, 0, 1), new Date()),
    deadline: randomDate(new Date(), deadline),
    subject: subject,
    assignment: assignment,
    totalMark: totalMark,
    passingMark: passingMark,
    mark: mark,
    status: (
      <React.Fragment>
        {status === 1 && <span className="badge bg-primary inline-block me-1">Granted</span>}
        {status === 2 && <span className="badge bg-warning inline-block me-1">Cancelled</span>}
        {status === 3 && <span className="badge bg-success inline-block me-1">Failed</span>}
        {status === 4 && <span className="badge bg-danger inline-block">Rejected</span>}
      </React.Fragment>
    )
  };
};

export default function makeData(...lens) {
  const makeDataLevel = (depth = 0) => {
    const len = lens[depth];
    return range(len).map(() => {
      return {
        ...newPerson(),
        subRows: lens[depth + 1] ? makeDataLevel(depth + 1) : undefined
      };
    });
  };

  return makeDataLevel();
}
