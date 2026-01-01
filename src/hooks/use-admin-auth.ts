
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GlobalLoadingManager } from "@/utils/loading-utils";
import { useToast } from "./use-toast";

// The admin key to check against
const ADMIN_KEY = "brimoZ01159";

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if the user is authenticated
    const checkAuth = () => {
      setIsLoading(true);
      const storedKey = GlobalLoadingManager.getData<string>("adminAuthKey", "");
      const isValid = storedKey === ADMIN_KEY;
      setIsAuthenticated(isValid);
      setIsLoading(false);
      
      return isValid;
    };

    // Perform the check
    const isValid = checkAuth();
    
    // If not on the login page and not authenticated, redirect
    const currentPath = window.location.pathname;
    if (currentPath === "/admin-dashboard" && !isValid) {
      navigate("/admin-login");
    }
  }, [navigate]);

  const login = (key: string) => {
    if (key === ADMIN_KEY) {
      // Store the auth key in Global Loading Manager for persistence
      GlobalLoadingManager.setData("adminAuthKey", key);
      setIsAuthenticated(true);
      
      toast({
        title: "Login Successful",
        description: "Welcome to the admin dashboard"
      });
      
      navigate("/admin-dashboard");
      return true;
    } else {
      toast({
        title: "Invalid Admin Key",
        description: "The provided key is incorrect",
        variant: "destructive"
      });
      return false;
    }
  };

  const logout = () => {
    // Remove the auth key
    GlobalLoadingManager.setData("adminAuthKey", "");
    setIsAuthenticated(false);
    
    toast({
      title: "Logged Out",
      description: "You have been logged out from the admin dashboard"
    });
    
    navigate("/admin-login");
  };

  return {
    isAuthenticated,
    isLoading,
    login,
    logout
  };
}
