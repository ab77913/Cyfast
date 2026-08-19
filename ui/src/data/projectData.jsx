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
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toDateString();
};

const GetAvatar = (name) => {
  const photo_new = 'avatar-' + Math.floor(Math.random() * 5 + 1) + '.jpg';
  return <img src={getImageURL(photo_new)} className="img-fluid img-radius wid-40" alt={name} />;
};

const GetMembers = () => {
  const count = Math.floor(Math.random() * 3 + 1);
  const photo_new = 'avatar-' + Math.floor(Math.random() * 5 + 1) + '.jpg';
  const photo_new1 = 'avatar-' + Math.floor(Math.random() * 5 + 1) + '.jpg';
  const photo_new2 = 'avatar-' + Math.floor(Math.random() * 5 + 1) + '.jpg';

  return (
    <React.Fragment>
      <div>
        {count < 2 ? (
          <Link to="#">
            <img className="img-fluid img-radius m-r-5" src={getImageURL(photo_new)} style={{ width: '30px' }} alt="Task List" />
          </Link>
        ) : (
          ''
        )}
        {count < 3 ? (
          <Link to="#">
            <img className="img-fluid img-radius m-r-5" src={getImageURL(photo_new1)} style={{ width: '30px' }} alt="Task List" />
          </Link>
        ) : (
          ''
        )}
        {count === 3 ? (
          <Link to="#">
            <img className="img-fluid img-radius m-r-5" src={getImageURL(photo_new2)} style={{ width: '30px' }} alt="Task List" />
          </Link>
        ) : (
          ''
        )}
        <Link to="#">
          <i className="fas fa-plus f-w-600 me-5" />
        </Link>
      </div>
    </React.Fragment>
  );
};

let i = 1;

const newPerson = () => {
  const name = chance.name();
  const tags = Math.floor(Math.random() * 5 + 1);
  const status = Math.floor(Math.random() * 5 + 1);
  const description = chance.company();
  const deadline = new Date();
  deadline.setDate(new Date().getDate() + 365);

  return {
    id: i++,
    name: name,
    avatar: GetAvatar(name),
    description: (
      <React.Fragment>
        {description}
        <small className="d-block">
          <Link to="#" className="me-1">
            View
          </Link>{' '}
          |
          <Link to="#" className="mx-1">
            Contacts
          </Link>{' '}
          |
          <Link to="#" className="text-danger ms-1">
            Delete{' '}
          </Link>
        </small>
      </React.Fragment>
    ),
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
    active: (
      <div className="custom-control custom-switch">
        <input
          type="checkbox"
          className="custom-control-input"
          id={'customSwitch' + i}
          defaultChecked={Math.floor(Math.random() * 2 + 1) > 1}
        />
        <label className="custom-control-label" htmlFor={'customSwitch' + i} />
      </div>
    ),
    group: (
      <React.Fragment>
        {Math.floor(Math.random() * 2 + 1) > 1 && <span className="badge bg-danger inline-block me-1">Low Budget</span>}
        {Math.floor(Math.random() * 2 + 1) > 1 && <span className="badge bg-success inline-block me-1">High Budget</span>}
        {Math.floor(Math.random() * 2 + 1) > 1 && <span className="badge bg-warning inline-block me-1">VIP</span>}
        {Math.floor(Math.random() * 2 + 1) > 1 && <span className="badge bg-primary inline-block">Wholesaler</span>}
      </React.Fragment>
    ),
    tags: (
      <React.Fragment>
        {tags === 1 && <span className="badge bg-danger inline-block me-1">Wordpress</span>}
        {tags === 2 && <span className="badge bg-success inline-block me-1">Vue</span>}
        {tags === 3 && <span className="badge bg-warning inline-block me-1">React</span>}
        {tags === 4 && <span className="badge bg-primary inline-block">Angular</span>}
        {tags === 5 && <span className="badge bg-info inline-block">HTML</span>}
      </React.Fragment>
    ),
    status: (
      <React.Fragment>
        {status === 1 && <span className="badge bg-primary inline-block me-1">In Proccess</span>}
        {status === 2 && <span className="badge bg-warning inline-block me-1">Delay</span>}
        {status === 3 && <span className="badge bg-success inline-block me-1">Completed</span>}
        {status === 4 && <span className="badge bg-info inline-block">Pending</span>}
        {status === 5 && <span className="badge bg-danger inline-block">Cancelled</span>}
      </React.Fragment>
    ),
    member: GetMembers(),
    action: (
      <React.Fragment>
        <Link to="#" className="text-primary mx-1">
          <i className="feather icon-edit" />
        </Link>
        <Link to="#" className="text-danger">
          <i className="feather icon-trash-2" />
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
