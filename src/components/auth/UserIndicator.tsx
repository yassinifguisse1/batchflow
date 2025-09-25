import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const UserIndicator: React.FC = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <Button 
        variant="outline" 
        onClick={() => navigate('/auth')}
        className="gap-2"
      >
        <User className="h-4 w-4" />
        Sign In
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback>
          {user?.email?.charAt(0).toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground max-w-32 truncate">
        {user?.email}
      </span>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={signOut}
        className="gap-1"
      >
        <LogOut className="h-3 w-3" />
        Sign Out
      </Button>
    </div>
  );
};

export default UserIndicator;