import React from 'react';

// react-bootstrap
import { Row, Col, Alert, Button } from 'react-bootstrap';
import { NavLink } from 'react-router-dom';

// third party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project import
import useAuth from '../../../hooks/useAuth';
import useScriptRef from '../../../hooks/useScriptRef';

// ==============================|| JWT LOGIN ||============================== //

const JWTLogin = () => {
  const { login, isLoggedIn } = useAuth();
  const scriptedRef = useScriptRef();

  return (
    <>
      <hr />
      <Formik
        initialValues={{
          email: '',
          password: '',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          email: Yup.string().email('Must be a valid email').max(255).required('Email is required'),
          password: Yup.string().max(255).required('Password is required')
        })}
        onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
          try {
            await login(values.email, values.password);

            if (scriptedRef.current) {
              setStatus({ success: true });
              setSubmitting(false);
            }
          } catch (err) {
            console.error(err);

            setStatus({ success: false });
            setErrors({ submit: err.message });
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
          <form noValidate onSubmit={handleSubmit}>
            {errors.submit && (
              <Col sm={12}>
                <Alert variant="danger">{errors.submit}</Alert>
              </Col>
            )}

            <div className="form-group mb-3 text-start">
              <label className="text-signpagetext form-label" htmlFor="email">
                Email
              </label>
              <input
                className="form-control"
                placeholder="Enter Email ID"
                label="Email Address / Username"
                name="email"
                onBlur={handleBlur}
                onChange={handleChange}
                type="email"
                value={values.email}
              />
              {touched.email && errors.email && <small className="text-danger form-text">{errors.email}</small>}
            </div>
            <div className="form-group mb-1 text-start">
              <label className="text-signpagetext form-label" htmlFor="password">
                Password
              </label>
              <input
                className="form-control"
                placeholder="Password"
                label="Password"
                name="password"
                onBlur={handleBlur}
                onChange={handleChange}
                type="password"
                value={values.password}
              />
              {touched.password && errors.password && <small className="text-danger form-text">{errors.password}</small>}
            </div>

            <div className="mb-4 text-inprogress text-start text">Forgot password?</div>

            <Row>
              <Col mt={2}>
                <Button
                  className="btn-block mb-2 w-100"
                  color="primary"
                  disabled={isSubmitting}
                  size="large"
                  type="submit"
                  variant="primary"
                >
                  SIGN IN
                </Button>
              </Col>
            </Row>
          </form>
        )}
      </Formik>
    </>
  );
};

export default JWTLogin;
