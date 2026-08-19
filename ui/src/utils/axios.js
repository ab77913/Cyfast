// axios
import axios from 'axios';

const axiosServices = axios.create();

axiosServices.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject({
        message: 'Unable to connect to server. Please check backend services or network tunnel.'
      });
    }

    return Promise.reject(error.response.data || { message: 'Request failed with status ' + error.response.status });
  }
);

export default axiosServices;
