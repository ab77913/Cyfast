import axios from 'axios';

const cyfastAxios = axios.create({
  baseURL: import.meta.env.VITE_CYFAST_APP_API_URL || 'http://localhost:8088/'
});

cyfastAxios.interceptors.request.use((cfg) => {
  if (typeof window === 'undefined') return cfg;

  const tok = window.localStorage.getItem('serviceToken') || window.localStorage.getItem('accessToken');
  if (tok && !cfg.headers.Authorization) {
    cfg.headers.Authorization = `Bearer ${tok}`;
  }

  const userId = window.localStorage.getItem('userId');
  const organizationId = window.localStorage.getItem('organizationId') || window.localStorage.getItem('selectedOrganizationId');

  if (userId && !cfg.headers['x-user-id']) {
    cfg.headers['x-user-id'] = String(userId);
  }
  if (organizationId && !cfg.headers['x-organization-id']) {
    cfg.headers['x-organization-id'] = String(organizationId);
  }

  return cfg;
});

cyfastAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject({
        message: 'Unable to connect to server. Please check backend services or network tunnel.'
      });
    }

    // Only force login redirect for true auth failures after headers were sent.
    if (error.response.status === 401 && !window.location.href.includes('/login')) {
      const code = error.response.data?.code;
      if (code === 'UNAUTHENTICATED' || code === 'TOKEN_EXPIRED') {
        window.location.pathname = '/login';
      }
    }

    return Promise.reject(error.response.data || { message: 'Request failed with status ' + error.response.status });
  }
);

export default cyfastAxios;
