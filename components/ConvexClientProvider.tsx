'use client';

import { ReactNode, useCallback, useRef } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithAuth } from 'convex/react';
import { AuthKitProvider, useAuth, useAccessToken } from '@workos-inc/authkit-nextjs/components';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
        {children}
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}

function useAuthFromAuthKit() {
  const { user, loading: isLoading } = useAuth();
  const { accessToken, getAccessToken } = useAccessToken();
  const loading = isLoading ?? false;
  const authenticated = !!user && !!accessToken;

  // Keep a stable ref to the latest token so the callback doesn't need to
  // depend on accessToken/user, preventing unnecessary re-creations that
  // cause Convex to re-evaluate auth and hang in-flight queries.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const fetchAccessToken = useCallback(async () => {
    try {
      const token = await getAccessTokenRef.current();
      if (token) {
        return token;
      }
    } catch {
      // Fall back to the current in-memory token for transient refresh failures.
      if (tokenRef.current) {
        return tokenRef.current;
      }
    }
    return null;
  }, []);

  return {
    isLoading: loading,
    isAuthenticated: authenticated,
    fetchAccessToken,
  };
}
