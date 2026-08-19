import React from 'react';

// react-bootstrap
import { Card } from 'react-bootstrap';

// ==============================|| NAV CARD ||============================== //

const NavCard = () => {
  return (
    <React.Fragment>
      <Card className="mt-5">
        <Card.Body className="text-center">
          <i className="feather icon-sunset f-40"></i>
          <h6 className="mt-3">Help?</h6>
          <p>Please contact us on our email for need any support</p>
          <a href="https://codedthemes.support-hub.io/" className="btn btn-primary btn-sm text-white m-0">
            Support
          </a>
        </Card.Body>
      </Card>
      <div className="version">
        <label disabled className="pe-auto">
          {import.meta.env.VITE_APP_VERSION}
        </label>
      </div>
    </React.Fragment>
  );
};

export default NavCard;
