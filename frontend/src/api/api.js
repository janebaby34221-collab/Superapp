import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // Uses .env variable
});

// Automatically include token for authenticated users
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export default API;

