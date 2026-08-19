import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// project import
import { BASE_URL } from '../../config/constant';
import useAuth from '../../hooks/useAuth';

// ==============================|| GUEST GUARD ||============================== //

const GuestGuard = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoggedIn) {
      navigate(location?.state?.from ? location?.state?.from : BASE_URL, {
        state: {
          from: ''
        },
        replace: true
      });
    }
  }, [isLoggedIn, navigate, location]);

  return children;
};

export default GuestGuard;
