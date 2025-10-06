import axios from "axios";

const API = axios.create({
  baseURL: "https://superapp-rhas.onrender.com/api", // your backend URL
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

export default API;

