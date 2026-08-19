import axios from 'axios';

const cyuserAxios = axios.create({
  baseURL: import.meta.env.VITE_CYFAST_USER_MANAGEMENT_API_URL || 'http://localhost:8087/'
});

cyuserAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject({
        message: 'Unable to connect to server. Please check backend services or network tunnel.'
      });
    }

    if (error.response.status === 401 && !window.location.href.includes('/login')) {
      window.location.pathname = '/login';
    }

    return Promise.reject(error.response.data || { message: 'Request failed with status ' + error.response.status });
  }
);

const serviceToken = window.localStorage.getItem('serviceToken');
cyuserAxios.defaults.headers.common.Authorization = `Bearer ${serviceToken}`;

export default cyuserAxios;
