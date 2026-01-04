import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        // Check for common RLS/policy errors
        if (error.code === '42P17') {
          console.error('RLS policy error - infinite recursion detected. Please check user_profiles policies.');
        } else if (error.code === '42501') {
          console.error('Permission denied - user may not have access to their profile.');
        } else {
          console.error('Error loading profile:', error.code, error.message);
        }
        setProfile(null);
        return;
      }

      if (!data) {
        console.warn('No profile found for user. User may need to complete profile setup.');
      }

      setProfile(data);
    } catch (error) {
      console.error('Unexpected error loading profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Map Supabase error messages to user-friendly messages
        let friendlyMessage = error.message;
        
        if (error.message.includes('Invalid login credentials')) {
          friendlyMessage = 'Invalid email or password. Please try again.';
        } else if (error.message.includes('Email not confirmed')) {
          friendlyMessage = 'Please verify your email before signing in.';
        } else if (error.message.includes('Too many requests')) {
          friendlyMessage = 'Too many login attempts. Please wait a moment and try again.';
        } else if (error.message.includes('User not found')) {
          friendlyMessage = 'No account found with this email address.';
        }
        
        return { error: new Error(friendlyMessage) };
      }

      // Record login to audit log
      if (data.user) {
        try {
          // Get user profile for name
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', data.user.id)
            .maybeSingle();

          await supabase.from('login_logs').insert([{
            user_id: data.user.id,
            user_email: data.user.email || email,
            user_name: profileData?.full_name || 'Unknown',
            login_time: new Date().toISOString(),
            user_agent: navigator.userAgent,
          }]);
        } catch (logError) {
          // Don't fail login if logging fails
          console.warn('Failed to record login:', logError);
        }
      }
      
      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: new Error('An unexpected error occurred. Please try again.') };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
