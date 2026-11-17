"use client";

import { useEffect, useState } from "react";

import { Dashboard } from "@/components/dashboard";
import { LoginView } from "@/components/login-view";
import { clearStoredToken, fetchMe, getStoredToken, type User } from "@/lib/api";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }

    fetchMe()
      .then(setUser)
      .catch(() => {
        clearStoredToken();
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-zinc-400">
        Carregando sessão do BrainRats...
      </main>
    );
  }

  if (!user) {
    return <LoginView onSuccess={setUser} />;
  }

  return (
    <Dashboard
      user={user}
      onUserUpdated={setUser}
      onLogout={() => setUser(null)}
    />
  );
}
