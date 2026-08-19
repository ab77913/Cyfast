import { createContext, useEffect, useReducer } from 'react';

// third-party
import { jwtDecode } from 'jwt-decode';

// reducer - state management
import { LOGIN, LOGOUT } from '../store/actions';
import authReducer from '../store/accountReducer';

// project import
import Loader from '../components/Loader/Loader';
import axios from '../utils/authAxios';

// constant
const initialState = {
  isLoggedIn: false,
  isInitialized: false,
  user: null
};

const verifyToken = (serviceToken) => {
  if (!serviceToken) {
    return false;
  }
  const decoded = jwtDecode(serviceToken);
  /**
   * Property 'exp' does not exist on type '<T = unknown>(token: string, options?: JwtDecodeOptions | undefined) => T'.
   */
  return decoded.exp > Date.now() / 1000;
};

const setSession = (serviceToken, user = null) => {
  if (serviceToken) {
    localStorage.setItem('serviceToken', serviceToken);
    localStorage.setItem('accessToken', serviceToken);
    axios.defaults.headers.common.Authorization = `Bearer ${serviceToken}`;
    if (user?.user_id != null) {
      localStorage.setItem('userId', String(user.user_id));
    }
    // Organization is selected from tenant context; default to 1 only when unset for local W1.
    if (!localStorage.getItem('organizationId') && user?.organization_id != null) {
      localStorage.setItem('organizationId', String(user.organization_id));
    } else if (!localStorage.getItem('organizationId')) {
      localStorage.setItem('organizationId', '1');
    }
  } else {
    localStorage.removeItem('serviceToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    delete axios.defaults.headers.common.Authorization;
  }
};

// ==============================|| JWT CONTEXT & PROVIDER ||============================== //

const JWTContext = createContext(null);

export const JWTProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const init = async () => {
      try {
        const serviceToken = window.localStorage.getItem('serviceToken');
        if (serviceToken && verifyToken(serviceToken)) {
          setSession(serviceToken);
          const response = await axios.get('/auth/me');
          const user = response.data;
          if (user?.user_id != null) {
            localStorage.setItem('userId', String(user.user_id));
          }
          dispatch({
            type: LOGIN,
            payload: {
              isLoggedIn: true,
              user
            }
          });
        } else {
          dispatch({
            type: LOGOUT
          });
        }
      } catch (err) {
        console.error(err);
        dispatch({
          type: LOGOUT
        });
      }
    };

    init();
  }, []);

  const login = async (email, password) => {
    const response = await axios.post('/auth/login', { email, password });
    if (response.status === 200) {
      const serviceToken = response.data.serviceToken || response.data.accessToken;
      const user = response.data.user;
      if (!serviceToken) {
        throw new Error('Login response did not include an access token.');
      }
      setSession(serviceToken, user);
      dispatch({
        type: LOGIN,
        payload: {
          isLoggedIn: true,
          user
        }
      });
    } else {
      throw new Error(response.message);
    }
  };

  const logout = () => {
    setSession(null);
    dispatch({ type: LOGOUT });
  };

  const resetPassword = async () => {};

  const updateProfile = () => {};

  if (state.isInitialized !== undefined && !state.isInitialized) {
    return <Loader />;
  }

  return <JWTContext.Provider value={{ ...state, login, logout, resetPassword, updateProfile }}>{children}</JWTContext.Provider>;
};

export default JWTContext;
