import axios from "axios";
import { API_BASE_URL } from "../config/api";
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "Something went wrong";
    return Promise.reject(new Error(message));
  },
); // ── API Functions ──
export const validateSession = async (sessionId) => {
  const res = await apiClient.get(`/session/${sessionId}/validate`);
  return res.data;
};
export const getUserProfile = async () => {
  const res = await apiClient.get("/user/profile");
  return res.data;
};
export const saveUserProfile = async (data) => {
  const res = await apiClient.post("/user/profile", {
    name: data.name,
    vpa: data.vpa,
    phone: data.phone,
  });
  return res.data;
};
export const beginMcpLogin = async (merchantId, force = false) => {
  const res = await apiClient.post("/auth/begin", {
    merchant_id: merchantId,
    force,
  });
  return res.data;
};
export const completeMcpLogin = async (merchantId, code) => {
  const res = await apiClient.post("/auth/complete", {
    merchant_id: merchantId,
    code,
  });
  return res.data;
};
export const getMcpLoginStatus = async (merchantId) => {
  const res = await apiClient.get(`/auth/status/${merchantId}`);
  return res.data;
};
export const completeSession = async (sessionId) => {
  const res = await apiClient.post(`/session/${sessionId}/complete`);
  return res.data;
};
export default apiClient;
