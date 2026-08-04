"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useAccount,
  useConnect,
  useSignMessage,
  useSignTypedData,
} from "wagmi";
import { api } from "@/lib/api";
import { formatAddress } from "@/lib/address";
import {
  getSessionAddress,
  getSessionToken,
  notifySessionChanged,
  SESSION_CHANGED_EVENT,
  setSession,
} from "@/lib/session";
import {
  compactRsFromEthereumSignature,
  lightPoolTypedDataFromPrepared,
} from "@/lib/lpSign";
import { requestPortfolioRefresh } from "@/lib/portfolio";

export const OPEN_CASH_DEPOSIT_EVENT = "open-cash-deposit";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();
  const router = useRouter();
  const pathname = usePathname();
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

  const authorizeAgent = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const prepared = await api.prepareSetAgent();
      const typed = lightPoolTypedDataFromPrepared(prepared);
      const ethSig = await signTypedDataAsync(typed);
      const signature = compactRsFromEthereumSignature(ethSig);
      await api.submitSetAgent(signature, prepared.unsigned_tx_hex);
      setAgentAuthorized(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "set_agent failed");
      return false;
    } finally {
      setBusy(false);
    }
  }, [signTypedDataAsync]);

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
        await authorizeAgent();
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
    void authorizeAgent().then((ok) => {
      if (!ok) {
        agentAttemptedFor.current = null;
      }
    });
  }, [loggedIn, sessionAddress, busy, agentAuthorized, authorizeAgent]);

  function onDeposit() {
    if (pathname === "/cash") {
      window.dispatchEvent(new Event(OPEN_CASH_DEPOSIT_EVENT));
      return;
    }
    router.push("/cash?action=deposit");
  }

  const [copied, setCopied] = useState(false);

  async function onCopyAddress() {
    if (!address) {
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
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
        {statusLabel ? (
          <span className="text-xs text-slate-500">{statusLabel}</span>
        ) : (
          <button
            type="button"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center transition hover:bg-emerald-100"
            onClick={onDeposit}
          >
            <span className="block text-xs font-medium text-emerald-700">
              Deposit
            </span>
          </button>
        )}
        <button
          type="button"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono text-xs font-medium text-emerald-700 hover:bg-emerald-100"
          title={copied ? "Copied" : `Click to copy ${address}`}
          onClick={() => void onCopyAddress()}
        >
          {copied ? "Copied" : formatAddress(address)}
        </button>
      </div>
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
