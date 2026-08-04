"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { api } from "@/lib/api";
import { formatAddress } from "@/lib/address";
import {
  clearSession,
  getSessionAddress,
  getSessionToken,
  notifySessionChanged,
  SESSION_CHANGED_EVENT,
  setSession,
} from "@/lib/session";
import {
  clearLpPrivateKey,
  resolveLpPrivateKey,
  signLpDigestForAddress,
} from "@/lib/lpSign";
import { requestPortfolioRefresh } from "@/lib/portfolio";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [agentAuthorized, setAgentAuthorized] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginAttemptedFor = useRef<string | null>(null);
  const agentAttemptedFor = useRef<string | null>(null);

  const refreshSession = useCallback(() => {
    setSessionAddress(getSessionAddress());
  }, []);

  useEffect(() => {
    refreshSession();
    window.addEventListener(SESSION_CHANGED_EVENT, refreshSession);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, refreshSession);
  }, [refreshSession]);

  useEffect(() => {
    async function loadAgent() {
      if (!getSessionToken()) {
        setAgentAuthorized(null);
        return;
      }
      try {
        const agent = await api.getAgent();
        setAgentAuthorized(agent.authorized);
      } catch {
        setAgentAuthorized(null);
      }
    }
    void loadAgent();
  }, [sessionAddress]);

  const authorizeAgent = useCallback(async (lpAddress: string) => {
    setBusy(true);
    setError(null);
    try {
      try {
        resolveLpPrivateKey(lpAddress);
      } catch {
        setError(
          "Missing LightPool signing key. Add NEXT_PUBLIC_LP_PRIVATE_KEY=<hex for this MetaMask address> to frontend/.env.local and restart npm run dev.",
        );
        return false;
      }
      const prepared = await api.prepareSetAgent();
      const signature = signLpDigestForAddress(prepared.digest_hex, lpAddress);
      await api.submitSetAgent(signature, prepared.unsigned_tx_hex);
      setAgentAuthorized(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "set_agent failed");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const login = useCallback(async () => {
    if (!address) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { message } = await api.authNonce(address);
      const signature = await signMessageAsync({ message });
      const verified = await api.authVerify(address, signature);
      setSession(verified.token, verified.address);
      setSessionAddress(verified.address);
      notifySessionChanged();
      setAgentAuthorized(verified.agent_authorized);
      requestPortfolioRefresh();
      if (!verified.agent_authorized) {
        agentAttemptedFor.current = null;
        await authorizeAgent(verified.address);
      }
    } catch (e) {
      loginAttemptedFor.current = null;
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }, [address, authorizeAgent, signMessageAsync]);

  const loggedIn =
    !!address &&
    !!sessionAddress &&
    sessionAddress.toLowerCase() === address.toLowerCase() &&
    !!getSessionToken();

  useEffect(() => {
    if (!isConnected || !address || busy || loggedIn) {
      return;
    }
    const key = address.toLowerCase();
    if (loginAttemptedFor.current === key) {
      return;
    }
    loginAttemptedFor.current = key;
    void login();
  }, [isConnected, address, busy, loggedIn, login]);

  useEffect(() => {
    if (!loggedIn || !sessionAddress || busy || agentAuthorized !== false) {
      return;
    }
    const key = sessionAddress.toLowerCase();
    if (agentAttemptedFor.current === key) {
      return;
    }
    agentAttemptedFor.current = key;
    void authorizeAgent(sessionAddress).then((ok) => {
      if (!ok) {
        agentAttemptedFor.current = null;
      }
    });
  }, [loggedIn, sessionAddress, busy, agentAuthorized, authorizeAgent]);

  function onDisconnect() {
    loginAttemptedFor.current = null;
    agentAttemptedFor.current = null;
    clearSession();
    clearLpPrivateKey();
    notifySessionChanged();
    setAgentAuthorized(null);
    disconnect();
  }

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
        disabled={isPending}
        onClick={() => {
          const connector = connectors[0];
          if (connector) {
            connect({ connector });
          }
        }}
      >
        {isPending ? "Connecting…" : "Connect MetaMask"}
      </button>
    );
  }

  const statusLabel = (() => {
    if (busy && !loggedIn) {
      return "Signing in…";
    }
    if (busy && loggedIn && agentAuthorized !== true) {
      return "Authorizing agent…";
    }
    if (loggedIn && agentAuthorized === true) {
      return null;
    }
    if (loggedIn && agentAuthorized === false) {
      return "Authorizing agent…";
    }
    return "Sign in…";
  })();

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono text-xs font-medium text-emerald-700"
          title={address}
        >
          {formatAddress(address)}
        </span>
        {statusLabel ? (
          <span className="text-xs text-slate-500">{statusLabel}</span>
        ) : (
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            onClick={onDisconnect}
          >
            Disconnect
          </button>
        )}
      </div>
      {loggedIn && agentAuthorized && (
        <span className="text-[11px] text-slate-500">Agent ready</span>
      )}
      {error && (
        <div className="flex max-w-xs flex-col items-end gap-1">
          <p className="text-right text-[11px] text-red-600">{error}</p>
          <button
            type="button"
            className="text-[11px] text-sky-700 underline"
            disabled={busy}
            onClick={() => {
              loginAttemptedFor.current = null;
              agentAttemptedFor.current = null;
              void login();
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
