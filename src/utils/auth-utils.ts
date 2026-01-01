
// Secure admin authentication utilities

/**
 * Logs out the admin user by clearing authentication data
 */
export const logoutAdmin = (): void => {
  localStorage.removeItem('isAdmin');
  localStorage.removeItem('adminExpires');
  
  // Force redirect to home page
  window.location.href = '/';
};

/**
 * Checks if admin session is valid
 * @returns boolean indicating if the user is authenticated as admin
 */
export const isAdminAuthenticated = (): boolean => {
  try {
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    const expirationTime = localStorage.getItem('adminExpires');
    
    // Check if expired
    if (expirationTime && parseInt(expirationTime) < Date.now()) {
      // Clear expired credentials
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('adminExpires');
      return false;
    }
    
    return adminStatus;
  } catch (error) {
    console.error("Error checking admin authentication:", error);
    return false;
  }
};

/**
 * Extends the admin session by resetting the expiration time
 * @param hours Number of hours to extend the session
 */
export const extendAdminSession = (hours: number = 24): void => {
  if (isAdminAuthenticated()) {
    const newExpirationTime = Date.now() + (hours * 60 * 60 * 1000);
    localStorage.setItem('adminExpires', newExpirationTime.toString());
  }
};
