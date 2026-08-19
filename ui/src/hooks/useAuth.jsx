import { useContext } from 'react';

// auth provider
import AuthContext from '../contexts/JWTContext';
// import AuthContext from '../contexts/FirebaseContext';
// import AuthContext from '../contexts/Auth0Context';

// ==============================|| AUTH HOOK ||============================== //

const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) throw new Error('context must be use inside provider');

  return context;
};

export default useAuth;
