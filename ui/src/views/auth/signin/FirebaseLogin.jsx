import React from 'react';
// react-bootstrap
import { Row, Col, Button, Alert } from 'react-bootstrap';

// third party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project import
import useAuth from '../../../hooks/useAuth';
import useScriptRef from '../../../hooks/useScriptRef';

// ==============================|| FIREBASE LOGIN ||============================== //

const FirebaseLogin = ({ className, ...rest }) => {
  const scriptedRef = useScriptRef();

  const { firebaseEmailPasswordSignIn, firebaseGoogleSignIn } = useAuth();

  const googleHandler = async () => {
    try {
      await firebaseGoogleSignIn();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <React.Fragment>
      <Formik
        initialValues={{
          email: 'info@codedthemes.com',
          password: '123456',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          email: Yup.string().email('Must be a valid email').max(255).required('Email is required'),
          password: Yup.string().max(255).required('Password is required')
        })}
        onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
          try {
            await firebaseEmailPasswordSignIn(values.email, values.password);

            if (scriptedRef.current) {
              setStatus({ success: true });
              setSubmitting(true);
            }
          } catch (err) {
            console.error(err);
            if (scriptedRef.current) {
              setStatus({ success: false });
              setErrors({ submit: err.message });
              setSubmitting(false);
            }
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
          <form noValidate onSubmit={handleSubmit} className={className} {...rest}>
            <div className="form-group mb-3">
              <input
                className={touched.email && errors.email ? 'is-invalid form-control' : 'form-control'}
                label="Email Address / Username"
                name="email"
                onBlur={handleBlur}
                onChange={handleChange}
                type="email"
                value={values.email}
              />
              {touched.email && errors.email && <small className="text-danger form-text">{errors.email}</small>}
            </div>
            <div className="form-group mb-4">
              <input
                className={touched.password && errors.password ? 'is-invalid form-control' : 'form-control'}
                label="Password"
                name="password"
                onBlur={handleBlur}
                onChange={handleChange}
                type="password"
                value={values.password}
              />
              {touched.password && errors.password && <small className="text-danger form-text">{errors.password}</small>}
            </div>

            {errors.submit && (
              <Col sm={12}>
                <Alert variant="danger">{errors.submit}</Alert>
              </Col>
            )}

            <div className="custom-control custom-checkbox  text-start mb-4 mt-2">
              <input type="checkbox" className="custom-control-input" id="customCheck1" />
              <label className="custom-control-label mx-2" htmlFor="customCheck1">
                Save credentials.
              </label>
            </div>

            <Row>
              <Col mt={2}>
                <Button className="btn-block" color="primary" disabled={isSubmitting} size="large" type="submit" variant="primary">
                  Signin
                </Button>
              </Col>
            </Row>
          </form>
        )}
      </Formik>

      <Row>
        <Col sm={12}>
          <h5 className="my-3"> OR </h5>
        </Col>
      </Row>

      <Row>
        <Col sm={12}>
          <Button onClick={googleHandler} variant="danger">
            <i className="fa fa-lock" /> Sign in with Google
          </Button>
        </Col>
      </Row>

      <hr />
    </React.Fragment>
  );
};

export default FirebaseLogin;
