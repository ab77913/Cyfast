import { Link } from 'react-router-dom';

// third party
import { Chance } from 'chance';

// assets
import avatar1 from 'assets/images/user/avatar-1.jpg';
import avatar2 from 'assets/images/user/avatar-2.jpg';
import avatar3 from 'assets/images/user/avatar-3.jpg';

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

const GetUsers = () => {
  const count = Math.floor(Math.random() * 3 + 1);

  return (
    <>
      {count < 2 ? (
        <Link to="#">
          <img className="img-fluid img-radius" src={avatar1} style={{ width: '40px' }} alt="Task List" />
        </Link>
      ) : (
        ''
      )}
      {count < 3 ? (
        <Link to="#">
          <img className="img-fluid img-radius" src={avatar2} style={{ width: '40px' }} alt="Task List" />
        </Link>
      ) : (
        ''
      )}
      {count === 3 ? (
        <Link to="#">
          <img className="img-fluid img-radius" src={avatar3} style={{ width: '40px' }} alt="Task List" />
        </Link>
      ) : (
        ''
      )}
      <Link to="#" className="m-l-5 m-r-5 d-inline-block">
        <i className="fas fa-plus f-w-600" />
      </Link>
    </>
  );
};

const newPerson = () => {
  return {
    id: chance.integer({ min: 0, max: 1000 }),
    task: chance.sentence({ words: 2 }),
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
    status: (
      <div className="form-group form-primary mb-0" style={{ minWidth: '120px' }}>
        <select name="select" className="form-select form-select-sm" defaultValue="open">
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="invalid">Invalid</option>
          <option value="on-hold">On hold</option>
          <option value="close">Close</option>
        </select>
        <span className="form-bar" />
      </div>
    ),
    users: GetUsers(),
    action: (
      <>
        <Link to="#" className="btn btn-icon btn-rounded btn-outline-primary me-1">
          <span className="fas fa-book" />
        </Link>
        <Link to="#" className="btn btn-icon btn-rounded btn-outline-warning me-1">
          <span className="fas fa-edit" />
        </Link>
        <Link to="#" className="btn btn-icon btn-rounded btn-outline-danger me-1">
          <span className="fas fa-trash" />
        </Link>
      </>
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
