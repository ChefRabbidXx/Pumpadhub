import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-xl">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tighter">
          <span className="text-primary">404</span> - Page Not Found
        </h1>
        
        <p className="text-lg text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex justify-center mt-8">
          <Button 
            onClick={() => navigate('/')}
            className="bg-primary hover:bg-primary/90"
            size="lg"
          >
            Go Home
          </Button>
        </div>
        
        <div className="mt-8 p-4 bg-card rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            Looking for something specific? Try navigating using the sidebar or head back to the homepage.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
