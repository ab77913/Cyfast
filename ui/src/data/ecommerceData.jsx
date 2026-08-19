import React from 'react';
import { Link } from 'react-router-dom';

// third party
import { Chance } from 'chance';

// project import
import { getImageURL, getProdImageURL } from 'utils/getImage';

const chance = new Chance();
const range = (len) => {
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(i);
  }
  return arr;
};

const GetAvatar = (name) => {
  const photo_new = 'avatar-' + Math.floor(Math.random() * 5 + 1) + '.jpg';
  return <img src={getImageURL(photo_new)} className="img-fluid img-radius wid-40" alt={name} />;
};

const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toDateString();
};

const GetProducts = () => {
  const count = Math.floor(Math.random() * 5 + 0);
  const photo_new = 'prod-' + Math.floor(Math.random() * 12 + 1) + '.jpg';

  return (
    <React.Fragment>
      <img src={getProdImageURL(photo_new)} alt="contact-img" title="contact-img" className="rounded me-3 wid-40" />
      <p className="m-0 d-inline-block align-middle font-16">
        <Link to="#" className="text-body">
          Amazing Rolling Chair
        </Link>
        <br />
        {count >= 1 ? <span className="text-warning feather icon-star-on" /> : <span className="text-warning feather icon-star" />}
        {count > 2 ? <span className="text-warning feather icon-star-on" /> : <span className="text-warning feather icon-star" />}
        {count > 3 ? <span className="text-warning feather icon-star-on" /> : <span className="text-warning feather icon-star" />}
        {count > 4 ? <span className="text-warning feather icon-star-on" /> : <span className="text-warning feather icon-star" />}
        {count >= 5 ? <span className="text-warning feather icon-star-on" /> : <span className="text-warning feather icon-star" />}
      </p>
    </React.Fragment>
  );
};

let i = 1;

const newPerson = () => {
  const name = chance.name();
  const status = Math.floor(Math.random() * 5 + 1);

  return {
    id: i++,
    name: name,
    avatar: GetAvatar(name),
    email: name.toLowerCase().replace(/\s/g, '') + '@gmail.com',
    phone:
      '+9' +
      Math.floor(Math.random() * 9 + 1) +
      ' ' +
      chance.integer({ min: 100, max: 999 }) +
      '-' +
      chance.integer({ min: 100000, max: 999999 }),
    product: GetProducts(),
    price: '$' + Math.floor(Math.random() * 999 + 100) + '.' + Math.floor(Math.random() * 99 + 0),
    quantity: Math.floor(Math.random() * 999 + 100),
    age: Math.floor(Math.random() * 60 + 18),
    products: Math.floor(Math.random() * 999 + 1),
    date: randomDate(new Date(2012, 0, 1), new Date()),
    status: (
      <React.Fragment>
        {status === 1 && <span className="badge bg-primary inline-block me-1">In Proccess</span>}
        {status === 2 && <span className="badge bg-warning inline-block me-1">Delay</span>}
        {status === 3 && <span className="badge bg-success inline-block me-1">Completed</span>}
        {status === 4 && <span className="badge bg-info inline-block">Pending</span>}
        {status === 5 && <span className="badge bg-danger inline-block">Cancelled</span>}
      </React.Fragment>
    ),
    action: (
      <React.Fragment>
        <Link to="#" className="btn btn-icon btn-rounded btn-outline-primary mx-1">
          <i className="feather icon-eye" />
        </Link>
        <Link to="#" className="btn btn-icon btn-rounded btn-outline-info mx-1">
          <i className="feather icon-edit" />
        </Link>
        <Link to="#" className="btn btn-icon btn-rounded btn-outline-danger mx-1">
          <i className="feather icon-trash-2" />
        </Link>
      </React.Fragment>
    ),
    options: (
      <React.Fragment>
        <Link to="#" className="btn btn-icon btn-rounded btn-info mx-1">
          <i className="feather icon-edit" />
          &nbsp;Edit
        </Link>
        <Link to="#" className="btn btn-icon btn-rounded btn-danger mx-1">
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
