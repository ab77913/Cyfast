import React from 'react';
import { NavLink } from 'react-router-dom';

// project import
import Breadcrumb from '../../../layouts/AdminLayout/Breadcrumb';

// assets
import authLogo from '../../../assets/images/auth/auth-logo.png';
import authLogoDark from '../../../assets/images/auth/auth-logo-dark.png';

// ==============================|| SIGN IN 2 ||============================== //

const Signin2 = () => {
  return (
    <React.Fragment>
      <Breadcrumb />
      <div className="auth-wrapper align-items-stretch aut-bg-img">
        <div className="flex-grow-1">
          <div className="h-100 d-md-flex align-items-center auth-side-img">
            <div className="col-sm-10 auth-content w-auto">
              <img src={authLogo} alt="" className="img-fluid" />
              <h1 className="text-white my-4">Welcome Back!</h1>
              <h4 className="text-white font-weight-normal">
                Signin to your account and get explore the Gradient Able Dashboard Template.
                <br />
                Do not forget to play with live customizer
              </h4>
            </div>
          </div>
          <div className="auth-side-form">
            <div className=" auth-content">
              <img src={authLogoDark} alt="" className="img-fluid mb-4 d-block d-xl-none d-lg-none" />
              <h3 className="mb-4 f-w-400">Signin</h3>
              <div className="input-group mb-3">
                <input type="email" className="form-control" placeholder="Email address" />
              </div>
              <div className="input-group mb-4">
                <input type="password" className="form-control" placeholder="Password" />
              </div>
              <div className="custom-control custom-checkbox  text-start mb-4 mt-2">
                <input type="checkbox" className="custom-control-input" id="customCheck1" defaultChecked={false} />
                <label className="custom-control-label mx-2" htmlFor="customCheck1">
                  Save credentials.
                </label>
              </div>
              <button className="btn btn-block btn-primary mb-0">Signin</button>
              <div className="text-center">
                <div className="saprator my-4">
                  <span>OR</span>
                </div>
                <button className="btn text-white bg-facebook mb-2 mr-2  wid-40 px-0 hei-40 rounded-circle">
                  <i className="fab fa-facebook-f" />
                </button>
                <button className="btn text-white bg-googleplus mb-2 mx-2 wid-40 px-0 hei-40 rounded-circle">
                  <i className="fab fa-google-plus-g" />
                </button>
                <button className="btn text-white bg-twitter mb-2  wid-40 px-0 hei-40 rounded-circle">
                  <i className="fab fa-twitter" />
                </button>
                <p className="mb-2 text-muted">
                  Forgot password?{' '}
                  <NavLink to="/auth/reset-password-2" className="f-w-400">
                    Reset
                  </NavLink>
                </p>
                <p className="mb-0 text-muted">
                  Don’t have an account?{' '}
                  <NavLink to="/auth/signup-2" className="f-w-400">
                    Signup
                  </NavLink>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

export default Signin2;
