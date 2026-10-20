import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { acceptInvite as apiAcceptInvite, ApiError, deleteAccount as apiDeleteAccount, fetchProfile, logIn as apiLogIn, logOut as apiLogOut, setSignedOutHandler } from './api';
import { loadSession, saveSession, type Profile, type Session } from './session';

type Status = 'checking' | 'signedOut' | 'signedIn';

interface AuthCtx {
  status: Status;
  profile: Profile | null;
  /** Shown on the login screen after the server ended the session. */
  notice: string | null;
  logIn: (email: string, password: string) => Promise<void>;
  acceptInvite: (code: string, email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('checking');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signedIn = useCallback(async (s: Session) => {
    await saveSession(s);
    setProfile({ email: s.email, merchant: s.merchant });
    setNotice(null);
    setStatus('signedIn');
  }, []);

  const clear = useCallback(async (message: string | null) => {
    await saveSession(null);
    setProfile(null);
    setNotice(message);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => {
      clear('Your session has ended. Please log in again.');
    });
    (async () => {
      const s = await loadSession();
      if (!s) return setStatus('signedOut');
      // Open straight away with the saved profile, then refresh it (e.g. a renamed merchant)
      setProfile({ email: s.email, merchant: s.merchant });
      setStatus('signedIn');
      try {
        const p = await fetchProfile();
        await saveSession({ ...s, ...p });
        setProfile(p);
      } catch {
        /* offline: keep the saved profile; a 401 signs out through the handler */
      }
    })();
    return () => setSignedOutHandler(null);
  }, [clear]);

  const value = useMemo<AuthCtx>(() => ({
    status,
    profile,
    notice,
    logIn: async (email, password) => signedIn(await apiLogIn(email.trim(), password)),
    acceptInvite: async (code, email, password) => signedIn(await apiAcceptInvite(code.trim(), email.trim(), password)),
    logOut: async () => {
      await apiLogOut().catch(() => undefined); // sign out on the phone even if the server can't be reached
      await clear(null);
    },
    deleteAccount: async (password) => {
      await apiDeleteAccount(password);
      await clear('Your account has been deleted.');
    },
  }), [status, profile, notice, signedIn, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

export const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
