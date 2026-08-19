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

const newPerson = () => {
  const name = chance.name();
  const description = chance.sentence({ words: 2 });
  return {
    id: chance.integer({ min: 10, max: 99 }),
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
