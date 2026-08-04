"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, type Hex } from "viem";
import { api, type BridgeConfig } from "@/lib/api";
import { bridgeAbi, erc20Abi } from "@/lib/bridgeAbi";
import { signLpDigestForAddress } from "@/lib/lpSign";
import { getSessionToken } from "@/lib/session";
import { requestPortfolioRefresh } from "@/lib/portfolio";
import type { BalanceEntry } from "@/lib/types";

export function CashBridge() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [config, setConfig] = useState<BridgeConfig | null>(null);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [evmBalance, setEvmBalance] = useState<string>("—");
  const [depositAmount, setDepositAmount] = useState("10");
  const [withdrawAmount, setWithdrawAmount] = useState("1");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<Hex | undefined>();
  const [pollHint, setPollHint] = useState<string | null>(null);

  const receipt = useWaitForTransactionReceipt({ hash: pendingTx });

  const refreshBalances = useCallback(async () => {
    try {
      const next = await api.getBalances();
      setBalances(next);
      requestPortfolioRefresh();
    } catch {
      // ignore
    }
  }, []);

  const refreshEvmBalance = useCallback(async () => {
    if (!publicClient || !address || !config?.eth_usdt) {
      setEvmBalance("—");
      return;
    }
    try {
      const raw = await publicClient.readContract({
        address: config.eth_usdt as Hex,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      setEvmBalance((Number(raw) / 1e6).toString());
    } catch {
      setEvmBalance("—");
    }
  }, [publicClient, address, config?.eth_usdt]);

  useEffect(() => {
    void api
      .getBridgeConfig()
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : "config failed"));
  }, []);

  useEffect(() => {
    void refreshBalances();
    void refreshEvmBalance();
  }, [refreshBalances, refreshEvmBalance, address]);

  useEffect(() => {
    if (receipt.isSuccess) {
      setStatus("EVM deposit confirmed. Waiting for Link to mint LP USDT…");
      setPollHint("Polling LightPool balances…");
      let tries = 0;
      const timer = window.setInterval(() => {
        tries += 1;
        void refreshBalances();
        if (tries >= 30) {
          window.clearInterval(timer);
          setPollHint("Still pending? Ensure lightpool-link is running.");
        }
      }, 2000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [receipt.isSuccess, refreshBalances]);

  const lpCash = balances.find(
    (b) =>
      b.symbol === (config?.cash_token_symbol ?? "USDT") ||
      (config?.lp_token &&
        b.token.toLowerCase() === config.lp_token.toLowerCase()),
  );

  async function onDeposit() {
    setError(null);
    setStatus(null);
    if (!isConnected || !address) {
      setError("Connect MetaMask first");
      return;
    }
    if (!config?.eth_usdt || !config.bridge) {
      setError("Bridge config incomplete (ETH_USDT / BRIDGE)");
      return;
    }
    try {
      const amount = parseUnits(depositAmount, 6);
      if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount <= BigInt(0)) {
        throw new Error("invalid amount");
      }
      const amountU64 = BigInt(amount.toString());
      setStatus("Approving USDT…");
      const approveHash = await writeContractAsync({
        address: config.eth_usdt as Hex,
        abi: erc20Abi,
        functionName: "approve",
        args: [config.bridge as Hex, amountU64],
      });
      await publicClient?.waitForTransactionReceipt({ hash: approveHash });
      setStatus("Depositing to Bridge…");
      const depositHash = await writeContractAsync({
        address: config.bridge as Hex,
        abi: bridgeAbi,
        functionName: "deposit",
        args: [amountU64, address],
      });
      setPendingTx(depositHash);
      setStatus("Waiting for EVM confirmation…");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deposit failed");
    }
  }

  async function onWithdraw() {
    setError(null);
    setStatus(null);
    if (!address) {
      setError("Connect MetaMask first");
      return;
    }
    if (!getSessionToken()) {
      setError("Sign in to the app first");
      return;
    }
    try {
      setStatus("Preparing bridge withdraw…");
      const prepared = await api.prepareBridgeWithdraw(withdrawAmount, address);
      setStatus("Signing LightPool withdraw…");
      const signature = signLpDigestForAddress(prepared.digest_hex, address);
      const submitted = await api.submitBridgeWithdraw(
        signature,
        prepared.unsigned_tx_hex,
      );
      setStatus(
        `Withdraw submitted (${submitted.digest.slice(0, 18)}…). Pending EVM unlock via Link.`,
      );
      setPollHint("Link will requestWithdraw / finalizeWithdraw on Reth.");
      void refreshBalances();
      void refreshEvmBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdraw failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Balances</h2>
          <p className="text-sm text-slate-600">
            Reth USDT: <span className="font-medium">{evmBalance}</span>
          </p>
          <p className="text-sm text-slate-600">
            LightPool {config?.cash_token_symbol ?? "USDT"}:{" "}
            <span className="font-medium">
              {lpCash?.available ?? lpCash?.total ?? "0"}
            </span>
          </p>
          {config && (
            <p className="mt-2 break-all text-[11px] text-slate-400">
              Bridge {config.bridge ?? "—"} · LP {config.lp_token ?? "—"} · chain{" "}
              {config.chain_id}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            Deposit (MetaMask → Reth Bridge)
          </h2>
          <div className="mb-2 flex gap-2">
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount"
            />
            <button
              type="button"
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              onClick={() => void onDeposit()}
            >
              Deposit
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Mints LP USDT to your MetaMask address after Link confirm_dep.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            Withdraw (user-signed LightPool tx)
          </h2>
          <div className="mb-2 flex gap-2">
            <input
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount"
            />
            <button
              type="button"
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              onClick={() => void onWithdraw()}
            >
              Withdraw
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Burns LP USDT and unlocks EVM USDT to the same address via Link.
            Agent never signs withdraw.
          </p>
        </div>
      </div>

      {status && (
        <div className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {status}
        </div>
      )}
      {pollHint && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {pollHint}
        </div>
      )}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
