/**
 * App Context - Global state management for the extension
 */

import { createContext, useContext, ReactNode } from 'react';

interface AppContextType {
  version: string;
  extensionId: string;
  isProduction: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  const contextValue: AppContextType = {
    version: '1.0.0',
    extensionId: chrome?.runtime?.id || 'development',
    isProduction: process.env.NODE_ENV === 'production'
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;