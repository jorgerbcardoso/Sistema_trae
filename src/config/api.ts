/**
 * Configuração de URLs da API
 */

import { API_BASE_URL } from './environment';

export const API_URL = API_BASE_URL;

// Endpoints específicos
export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_URL}/auth/login.php`,
  LOGOUT: `${API_URL}/auth/logout.php`,
  FORGOT_PASSWORD: `${API_URL}/auth/forgot-password-v2.php`,
  RESET_PASSWORD: `${API_URL}/auth/reset-password.php`,
  
  // Users
  USERS_LIST: `${API_URL}/users/list.php`,
  USERS_CREATE: `${API_URL}/users/create.php`,
  USERS_UPDATE: `${API_URL}/users/update.php`,
  USERS_DELETE: `${API_URL}/users/delete.php`,
  USERS_CHANGE_PASSWORD: `${API_URL}/users/change-password.php`,
  USERS_CHANGE_EMAIL: `${API_URL}/users/change-email.php`,
  
  // Menu
  MENU_GET: `${API_URL}/menu/get_with_permissions.php`,
  
  // Dashboards
  DASHBOARD_OVERVIEW: `${API_URL}/dashboards/dre/overview.php`,
  DASHBOARD_REVENUE: `${API_URL}/dashboards/dre/revenue.php`,
  DASHBOARD_COSTS: `${API_URL}/dashboards/dre/costs.php`,
  DASHBOARD_LINES: `${API_URL}/dashboards/dre/lines.php`,
  DASHBOARD_PROFITABILITY: `${API_URL}/dashboards/dre/profitability.php`,
  
  // Admin
  ADMIN_DOMAINS_LIST: `${API_URL}/admin/domains/list.php`,
  ADMIN_DOMAINS_CREATE: `${API_URL}/admin/domains/create.php`,
  ADMIN_DOMAINS_DELETE: `${API_URL}/admin/domains/delete.php`,
  ADMIN_PERMISSIONS_GET: `${API_URL}/admin/permissions/get_domain_permissions.php`,
  ADMIN_PERMISSIONS_UPDATE: `${API_URL}/admin/permissions/update_domain_permissions.php`,
};
