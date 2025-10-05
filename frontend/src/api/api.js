import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:4000/api", // backend URL (adjust if using production)
});

// Automatically include token for authenticated users
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export default API;

