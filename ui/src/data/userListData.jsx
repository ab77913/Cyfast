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

const GetName = () => {
  const name = chance.first();
  const email = name.toLowerCase().replace(/\s/g, '') + '@gmail.com';
  const photo_new = 'avatar-' + Math.floor(Math.random() * 5 + 1) + '.jpg';
  return (
    <>
      <div className="d-inline-block align-middle">
        <img src={getImageURL(photo_new)} alt="user" className="img-radius align-top m-r-15" style={{ width: '40px' }} />
        <div className="d-inline-block">
          <h6 className="m-b-0 text-capitalize">{name}</h6>
          <p className="m-b-0">{email}</p>
        </div>
      </div>
    </>
  );
};

const newPerson = () => {
  const statusChance = Math.random();
  return {
    name: <GetName />,
    position: chance.profession(),
    office: chance.city(),
    age: Math.floor(Math.random() * 60 + 18),
    date: randomDate(new Date(2012, 0, 1), new Date()),
    salary: Math.floor(Math.random() * 100 * 1000),
    status:
      statusChance > 0.66 ? (
        <div>
          <span className="badge badge-light-success">Active</span>
          <div className="overlay-edit">
            <button type="button" className="btn btn-icon btn-success">
              <i className="feather icon-check-circle">
                {' '}
                <span className="sr-only" />{' '}
              </i>
            </button>
            <button type="button" className="btn btn-icon btn-danger">
              <i className="feather icon-trash-2">
                <span className="sr-only" />
              </i>
            </button>
          </div>
        </div>
      ) : statusChance > 0.33 ? (
        <div>
          <span className="badge badge-light-danger">Inactive</span>
          <div className="overlay-edit">
            <button type="button" className="btn btn-icon btn-success">
              <i className="feather icon-check-circle">
                {' '}
                <span className="sr-only" />{' '}
              </i>
            </button>
            <button type="button" className="btn btn-icon btn-danger">
              <i className="feather icon-trash-2">
                <span className="sr-only" />
              </i>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <span className="badge badge-light-warning">In Process</span>
          <div className="overlay-edit">
            <button type="button" className="btn btn-icon btn-success">
              <i className="feather icon-check-circle">
                {' '}
                <span className="sr-only" />{' '}
              </i>
            </button>
            <button type="button" className="btn btn-icon btn-danger">
              <i className="feather icon-trash-2">
                <span className="sr-only" />
              </i>
            </button>
          </div>
        </div>
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
