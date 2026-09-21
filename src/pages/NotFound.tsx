import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm space-y-4 p-8 text-center">
        <p className="font-mono text-sm text-brand-accent">404</p>
        <h1 className="text-xl font-semibold tracking-tight text-navy-deep">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has moved.
        </p>
        <Button asChild variant="brand">
          <Link to="/">Return to home</Link>
        </Button>
      </Card>
    </div>
  );
};

export default NotFound;
