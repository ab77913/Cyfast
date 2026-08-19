import axios from 'axios';

const cylogAxios = axios.create({
  baseURL: import.meta.env.VITE_CYFAST_LOGS_API_URL || 'http://localhost:8090/'
});

cylogAxios.interceptors.response.use(
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

export default cylogAxios;
