import React from 'react';
import { Link } from 'react-router-dom';

// third party
import { Chance } from 'chance';

const chance = new Chance();
const range = (len) => {
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(i);
  }
  return arr;
};

let i = 1;

const newPerson = () => {
  const name = chance.name();

  let subject = chance.sentence({ words: 2 });
  subject = (subject.charAt(0).toUpperCase() + subject.slice(1)).replaceAll('-', ' ');

  return {
    id: i++,
    name: name,
    subject: subject,
    action: (
      <React.Fragment>
        <Link to="#" className="btn btn-icon btn-rounded btn-info mx-1">
          <i className="feather icon-edit" />
          &nbsp;Edit
        </Link>
        <Link to="#" className="btn btn-icon btn-rounded btn-danger">
          <i className="feather icon-trash-2" />
          &nbsp;Delete
        </Link>
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
