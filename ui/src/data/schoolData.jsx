import React from 'react';
import { Link } from 'react-router-dom';

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
  let today = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  var dd = today.getDate();
  var mm = today.getMonth() + 1;
  var yyyy = today.getFullYear();
  if (dd < 10) {
    dd = '0' + dd;
  }

  if (mm < 10) {
    mm = '0' + mm;
  }

  return yyyy + '-' + mm + '-' + dd;
};

const GetAvatar = (name) => {
  const photo_new = 'avatar-' + Math.floor(Math.random() * 5 + 1) + '.jpg';
  return <img src={getImageURL(photo_new)} className="img-fluid img-radius wid-40" alt={name} />;
};

const newPerson = () => {
  const name = chance.name();
  let department = chance.profession();
  department = (department.charAt(0).toUpperCase() + department.slice(1)).replaceAll('-', ' ');

  const number = Math.floor(Math.random() * 6 + 1);
  let variant = '';
  switch (number) {
    case 1:
      variant = 'primary';
      break;
    case 2:
      variant = 'danger';
      break;
    case 3:
      variant = 'success';
      break;
    case 4:
      variant = 'info';
      break;
    case 5:
      variant = 'warning';
      break;
    case 6:
      variant = 'dark';
      break;
    default:
      variant = 'primary';
  }

  const bloodNumber = Math.floor(Math.random() * 8 + 1);
  let bloodGroup = '';
  switch (bloodNumber) {
    case 1:
      bloodGroup = 'A+';
      break;
    case 2:
      bloodGroup = 'B+';
      break;
    case 3:
      bloodGroup = 'AB+';
      break;
    case 4:
      bloodGroup = 'O+';
      break;
    case 5:
      bloodGroup = 'A-';
      break;
    case 6:
      bloodGroup = 'B-';
      break;
    case 7:
      bloodGroup = 'AB-';
      break;
    default:
      bloodGroup = 'O-';
  }

  return {
    id: chance.integer({ min: 10, max: 99 }),
    name: name,
    department: department,
    avatar: GetAvatar(name),
    icon: <span className={'badge bg-' + variant + ' text-capitalize'}>{name.charAt(0)}</span>,
    email: name.toLowerCase().replace(/\s/g, '') + '@gmail.com',
    phone:
      '+9' +
      Math.floor(Math.random() * 9 + 1) +
      ' ' +
      chance.integer({ min: 100, max: 999 }) +
      '-' +
      chance.integer({ min: 100000, max: 999999 }),
    roll: chance.integer({ min: 10, max: 99 }),
    sex: Math.floor(Math.random() * 2 + 1) > 1 ? 'Male' : 'Female',
    date: (
      <div className="form-group form-primary mb-0">
        <input
          type="date"
          className="form-control"
          defaultValue={randomDate(new Date(2012, 0, 1), new Date())}
          onChange={(e) => console.log(e)}
        />
        <span className="form-bar" />
      </div>
    ),
    age: Math.floor(Math.random() * 18 + 6),
    blood: bloodGroup,
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
