import React, { useState } from 'react';
// react-bootstrap
import { Row, Col, Alert, Button } from 'react-bootstrap';

// project import
import useAuth from '../../../hooks/useAuth';
import useScriptRef from '../../../hooks/useScriptRef';

// ==============================|| AUTH0 LOGIN ||============================== //

const Auth0Login = ({ className, ...rest }) => {
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const scriptedRef = useScriptRef();

  const loginHandler = async () => {
    try {
      await login();
    } catch (err) {
      if (scriptedRef.current) {
        setError(err.message);
      }
    }
  };

  return (
    <React.Fragment>
      <div className={className} {...rest}>
        <Row>
          {error && (
            <Col sm={12}>
              <Alert variant="danger">{error}</Alert>
            </Col>
          )}
          <Col sm={12}>
            <Button onClick={loginHandler} variant="primary" className="btn-block mb-4">
              <i className="fa fa-lock" /> Log in with Auth0
            </Button>
          </Col>
        </Row>
      </div>
      <Row>
        <Col sm={12}>
          <h5 className="my-3"> OR </h5>
        </Col>
      </Row>

      <Row>
        <Col sm={12}>
          <Button variant="danger">
            <i className="fa fa-lock" /> Sign in with Google
          </Button>
        </Col>
      </Row>

      <hr />
    </React.Fragment>
  );
};

export default Auth0Login;
