import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { User, Session } from '@supabase/supabase-js';

export type UserType = 'gestor' | 'diretor' | 'administrativo';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  sector: string;
  userType: UserType;
}

export const ALL_PAGES = [
  { path: '/', label: 'Dashboard' },
  { path: '/machines', label: 'Máquinas' },
  { path: '/checklists', label: 'Checklists' },
  { path: '/checklist-template', label: 'Modelo LPA' },
  { path: '/schedule', label: 'Cronograma' },
  { path: '/my-audits', label: 'Minhas Auditorias' },
  { path: '/mobile-audit', label: 'Auditoria Mobile' },
  { path: '/reports', label: 'Relatórios' },
  { path: '/analytics', label: 'Análise Gráfica' },
  { path: '/settings', label: 'Configurações' },
];

// Default pages for administrativo (limited)
const DEFAULT_ADMIN_PAGES = ['/', '/schedule', '/my-audits', '/mobile-audit'];

interface AuthContextType {
  currentUser: UserProfile | null;
  userType: UserType | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoggedIn: boolean;
  canAccessPage: (path: string) => boolean;
  getUserPermissions: (userId?: string) => string[];
  setUserPermissions: (userId: string, pages: string[]) => void;
  // Minifábrica filter: null = all, string = specific sector
  selectedMinifabrica: string | null;
  setSelectedMinifabrica: (value: string | null) => void;
  getEffectiveMinifabrica: () => string | null;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userType: null,
  login: async () => {},
  logout: async () => {},
  isLoggedIn: false,
  canAccessPage: () => false,
  getUserPermissions: () => [],
  setUserPermissions: () => {},
  selectedMinifabrica: null,
  setSelectedMinifabrica: () => {},
  getEffectiveMinifabrica: () => null,
});

export function useAuth() {
  return useContext(AuthContext);
}

function loadPermissions(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem('lpa_permissions');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePermissions(perms: Record<string, string[]>) {
  localStorage.setItem('lpa_permissions', JSON.stringify(perms));
}

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error getting user profile:', error);
      return null;
    }

    if (data) {
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        sector: data.sector,
        userType: getUserTypeFromRole(data.role),
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

function getUserTypeFromRole(role: string): UserType {
  const r = role.toLowerCase();
  if (r === 'gestor') return 'gestor';
  if (r === 'diretor') return 'diretor';
  return 'administrativo';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<Record<string, string[]>>(loadPermissions());
  const [selectedMinifabrica, setSelectedMinifabrica] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        getUserProfile(session.user.id).then(setCurrentUser);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await getUserProfile(session.user.id);
          setCurrentUser(profile);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const userType = currentUser ? currentUser.userType : null;

  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error('[Auth] Login falhou', {
          email,
          error,
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        });
        throw error;
      }
    } catch (error) {
      console.error('[Auth] Erro no login', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setSelectedMinifabrica(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const canAccessPage = (path: string): boolean => {
    if (!currentUser || !userType) return false;
    if (userType === 'gestor') return true;
    if (userType === 'diretor') return true;
    // administrativo
    const userPerms = permissions[currentUser.id] || DEFAULT_ADMIN_PAGES;
    return userPerms.includes(path);
  };

  const getUserPermissions = (userId?: string): string[] => {
    const targetId = userId || (currentUser ? currentUser.id : null);
    if (!targetId) return [];
    return permissions[targetId] || DEFAULT_ADMIN_PAGES;
  };

  const setUserPermissions = (userId: string, pages: string[]) => {
    if (!userId) return;
    const updated = { ...permissions, [userId]: pages };
    setPermissions(updated);
    savePermissions(updated);
  };

  // Returns the effective minifábrica filter for data queries
  const getEffectiveMinifabrica = (): string | null => {
    if (!currentUser || !userType) return null;
    if (userType === 'diretor') return currentUser.sector; // always locked to their sector
    if (userType === 'gestor') return selectedMinifabrica; // null = all, or specific
    return currentUser.sector; // administrativo sees their own sector
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      userType,
      login,
      logout,
      isLoggedIn: !!currentUser,
      canAccessPage,
      getUserPermissions,
      setUserPermissions,
      selectedMinifabrica,
      setSelectedMinifabrica,
      getEffectiveMinifabrica,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
