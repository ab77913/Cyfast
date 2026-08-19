import React from 'react';
//import { NavLink, Link } from 'react-router-dom';

// react-bootstrap
import { Card } from 'react-bootstrap';

// project import
import Breadcrumb from '../../../layouts/AdminLayout/Breadcrumb';
import AuthLogin from './JWTLogin';
// import useAuth from 'hooks/useAuth';
// import AuthLogin from './FirebaseLogin';
// import AuthLogin from './Auth0Login';

// assets
//import logoDark from '../../../assets/images/logo-dark.png';
import cyfastLogo from 'assets/images/auth/cyfast_logo.png';
// ==============================|| SIGN IN 1 ||============================== //

const Signin1 = () => {
  return (
    <React.Fragment>
      <Breadcrumb />
      <div className="auth-wrapper">
        <div className="logo-container-fixed">
          <img src={cyfastLogo} alt="Cyient Logo" className="left-logo ms-2" />
        </div>

        <div className="container-fluid flex-grow-1 d-flex">
          <div className="row flex-grow-1 w-100">
            <div className="col-md-6 d-flex flex-column justify-content-end text-white px-5">
              <p className="lead mb-3">
                Framework for Automation of Software and <br />
                System Testing
              </p>
              <p className="text-white-50 mb-5">Get started in no time, scale up with no limit, for any team, at any level.</p>
            </div>
            <div className="col-md-6 d-flex flex-column justify-content-center align-items-center">
              <div className="auth-content">
                <div className="auth-bg">
                  <span className="r" />
                  <span className="r s" />
                  <span className="r s" />
                  <span className="r" />
                </div>
                <Card className="borderless text-center">
                  <Card.Body>
                    <p className="text-signpagetext mb-2 signin-header-text">
                      Sign in to your <span className="text-fastcolor">CyFAST</span> Account
                    </p>
                    <AuthLogin />
                  </Card.Body>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

export default Signin1;
