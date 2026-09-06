"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useSignTypedData,
} from "wagmi";
import { encodeFunctionData, parseUnits, type Hex } from "viem";
import { api, type BridgeConfig } from "@/lib/api";
import { bridgeAbi, erc20Abi } from "@/lib/bridgeAbi";
import {
  compactRsFromEthereumSignature,
  lightPoolTypedDataFromPrepared,
} from "@/lib/lpSign";
import { OPEN_CASH_DEPOSIT_EVENT } from "@/components/ConnectWallet";
import { getSessionToken } from "@/lib/session";
import { requestPortfolioRefresh } from "@/lib/portfolio";
import type { BalanceEntry } from "@/lib/types";
import { lightpoolLocal } from "@/lib/wallet";

type BridgeDialogKind = "deposit" | "withdraw";

async function ethSendTransaction(
  walletRequest: (args: {
    method: "eth_sendTransaction";
    params: [
      {
        from: Hex;
        to: Hex;
        data: Hex;
        gas: Hex;
      },
    ];
  }) => Promise<unknown>,
  params: { from: Hex; to: Hex; data: Hex; gas: Hex },
): Promise<Hex> {
  const hash = await walletRequest({
    method: "eth_sendTransaction",
    params: [params],
  });
  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error("MetaMask did not return a transaction hash");
  }
  return hash as Hex;
}

function AmountDialog({
  kind,
  initialAmount,
  busy,
  progress,
  hint,
  error,
  onClose,
  onConfirm,
}: {
  kind: BridgeDialogKind;
  initialAmount: string;
  busy: boolean;
  progress: string | null;
  hint: string | null;
  error: string | null;
  onClose: () => void;
  onConfirm: (amount: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const title = kind === "deposit" ? "Deposit" : "Withdraw";
  const buttonLabel = busy ? (progress ?? "Working…") : title;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onConfirm(amount);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={() => {
        if (!busy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-bridge-dialog-title"
        className="w-full max-w-md rounded-2xl border border-sky-100 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3
            id="cash-bridge-dialog-title"
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h3>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4">
          <div>
            <input
              id="cash-bridge-amount"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              disabled={busy}
              autoFocus
            />
          </div>
          {(progress || hint) && (
            <div className="space-y-1 text-sm">
              {progress && <p className="text-sky-700">{progress}</p>}
              {hint && <p className="text-amber-700">{hint}</p>}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !amount.trim()}
            className={
              kind === "deposit"
                ? "w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                : "w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            }
          >
            {buttonLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

export function CashBridge() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<BridgeConfig | null>(null);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [evmBalance, setEvmBalance] = useState<string>("—");
  const [dialog, setDialog] = useState<BridgeDialogKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingTx, setPendingTx] = useState<Hex | undefined>();
  const [pollHint, setPollHint] = useState<string | null>(null);
  const [awaitingMint, setAwaitingMint] = useState(false);
  const [awaitingUnlock, setAwaitingUnlock] = useState(false);
  const mintBaselineRef = useRef(0);
  const evmBaselineRef = useRef(0);

  const receipt = useWaitForTransactionReceipt({ hash: pendingTx });

  const lpAvailable = useCallback(
    (entries: BalanceEntry[]) => {
      const lp = entries.find(
        (b) =>
          b.symbol === (config?.cash_token_symbol ?? "USDT") ||
          (config?.lp_token != null &&
            b.token.toLowerCase() === config.lp_token.toLowerCase()),
      );
      return Number(lp?.available ?? lp?.total ?? "0");
    },
    [config],
  );

  useEffect(() => {
    function onOpenDeposit() {
      setError(null);
      setStatus(null);
      setDialog("deposit");
    }
    window.addEventListener(OPEN_CASH_DEPOSIT_EVENT, onOpenDeposit);
    return () =>
      window.removeEventListener(OPEN_CASH_DEPOSIT_EVENT, onOpenDeposit);
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "deposit") {
      setError(null);
      setStatus(null);
      setDialog("deposit");
      router.replace("/cash", { scroll: false });
    }
  }, [searchParams, router]);

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
    if (!receipt.isSuccess || !awaitingMint) {
      return undefined;
    }
    setStatus("EVM deposit confirmed. Waiting for Link to mint LP USDT…");
    setPollHint("Polling LightPool balances…");
    setBusy(true);
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      void refreshBalances();
      void refreshEvmBalance();
      if (tries >= 30) {
        window.clearInterval(timer);
        setPollHint("Still pending? Ensure lightpool-link is running.");
        setBusy(false);
        setAwaitingMint(false);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [receipt.isSuccess, awaitingMint, refreshBalances, refreshEvmBalance]);

  useEffect(() => {
    if (!awaitingMint || !receipt.isSuccess) {
      return;
    }
    if (lpAvailable(balances) > mintBaselineRef.current) {
      setStatus("LP USDT minted.");
      setPollHint(null);
      setBusy(false);
      setAwaitingMint(false);
    }
  }, [balances, awaitingMint, receipt.isSuccess, lpAvailable]);

  useEffect(() => {
    if (!awaitingUnlock) {
      return undefined;
    }
    setStatus("Withdraw submitted. Waiting for Link to unlock EVM USDT…");
    setPollHint("Polling Reth USDT balance…");
    setBusy(true);
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      void refreshBalances();
      void refreshEvmBalance();
      if (tries >= 45) {
        window.clearInterval(timer);
        setPollHint(
          "Still pending? Ensure lightpool-link is running (dispute period ~5s).",
        );
        setBusy(false);
        setAwaitingUnlock(false);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [awaitingUnlock, refreshBalances, refreshEvmBalance]);

  useEffect(() => {
    if (!awaitingUnlock) {
      return;
    }
    const evm = Number(evmBalance);
    if (!Number.isNaN(evm) && evm > evmBaselineRef.current) {
      setStatus("EVM USDT unlocked.");
      setPollHint(null);
      setBusy(false);
      setAwaitingUnlock(false);
      void refreshBalances();
    }
  }, [evmBalance, awaitingUnlock, refreshBalances]);

  const cashBalances = balances.filter(
    (b) => b.symbol !== "YES" && b.symbol !== "NO",
  );

  async function onDeposit(amountStr: string) {
    setError(null);
    if (!isConnected || !address) {
      setError("Connect MetaMask first");
      return;
    }
    if (!walletClient) {
      setError("MetaMask wallet client not ready. Reconnect MetaMask.");
      return;
    }
    if (!config?.eth_usdt || !config.bridge) {
      setError("Bridge config incomplete (ETH_USDT / BRIDGE)");
      return;
    }

    let amount: bigint;
    try {
      amount = parseUnits(amountStr, 6);
      if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount <= BigInt(0)) {
        throw new Error("invalid amount");
      }
    } catch {
      setError("invalid amount");
      return;
    }
    const amountU64 = BigInt(amount.toString());
    const expectedChainId = Number(config.chain_id || lightpoolLocal.id);
    const token = config.eth_usdt as Hex;
    const bridge = config.bridge as Hex;
    const from = address as Hex;

    flushSync(() => {
      setBusy(true);
      setStatus("Check MetaMask…");
    });

    try {
      if (chainId !== expectedChainId) {
        flushSync(() => {
          setStatus("Switch network in MetaMask…");
        });
        await switchChainAsync({ chainId: expectedChainId });
      }

      // Bypass wagmi/viem gas simulation (it can hang on local RPC) and open MetaMask directly.
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [bridge, amountU64],
      });
      flushSync(() => {
        setStatus("Confirm approve in MetaMask…");
      });
      const approveHash = await ethSendTransaction(
        (args) => walletClient.request(args as never),
        {
          from,
          to: token,
          data: approveData,
          gas: "0x7a120",
        },
      );
      flushSync(() => {
        setStatus("Waiting for approve confirmation…");
      });
      await publicClient?.waitForTransactionReceipt({ hash: approveHash });

      const depositData = encodeFunctionData({
        abi: bridgeAbi,
        functionName: "deposit",
        args: [token, amountU64, from],
      });
      flushSync(() => {
        setStatus("Confirm deposit in MetaMask…");
      });
      const depositHash = await ethSendTransaction(
        (args) => walletClient.request(args as never),
        {
          from,
          to: bridge,
          data: depositData,
          gas: "0xf4240",
        },
      );
      setPendingTx(depositHash);
      mintBaselineRef.current = lpAvailable(balances);
      flushSync(() => {
        setStatus("Waiting for EVM confirmation…");
        setPollHint(null);
        setAwaitingMint(true);
      });
      // Keep dialog open; busy stays true until mint poll finishes.
    } catch (e) {
      const message = e instanceof Error ? e.message : "Deposit failed";
      setError(message);
      setStatus(null);
      setPollHint(null);
      setAwaitingMint(false);
      setBusy(false);
    }
  }

  async function onWithdraw(amountStr: string) {
    setError(null);
    if (!address) {
      setError("Connect MetaMask first");
      return;
    }
    if (!getSessionToken()) {
      setError("Sign in to the app first");
      return;
    }

    flushSync(() => {
      setBusy(true);
      setStatus("Preparing withdraw…");
      setPollHint(null);
    });

    try {
      const prepared = await api.prepareBridgeWithdraw(amountStr, address);
      flushSync(() => {
        setStatus("Confirm withdraw in MetaMask…");
      });
      const typed = lightPoolTypedDataFromPrepared(prepared);
      const ethSig = await signTypedDataAsync(typed);
      const signature = compactRsFromEthereumSignature(ethSig);
      flushSync(() => {
        setStatus("Submitting withdraw…");
      });
      const submitted = await api.submitBridgeWithdraw(
        signature,
        prepared.unsigned_tx_hex,
      );
      const baseline = Number(evmBalance);
      evmBaselineRef.current = Number.isNaN(baseline) ? 0 : baseline;
      flushSync(() => {
        setStatus(
          `Withdraw submitted (${submitted.digest.slice(0, 18)}…). Waiting for Link to unlock EVM USDT…`,
        );
        setPollHint("Polling Reth USDT balance…");
        setAwaitingUnlock(true);
      });
      void refreshBalances();
      void refreshEvmBalance();
      // Keep dialog open; busy stays true until unlock poll finishes.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdraw failed");
      setStatus(null);
      setPollHint(null);
      setAwaitingUnlock(false);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-end gap-3 border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            className="min-w-[136px] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center transition hover:bg-rose-100"
            onClick={() => {
              setError(null);
              setStatus(null);
              setPollHint(null);
              setDialog("withdraw");
            }}
          >
            <span className="block text-xs font-medium text-rose-700">
              Withdraw
            </span>
          </button>
        </div>

        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Locked</th>
              <th className="px-4 py-3">Available</th>
              <th className="px-4 py-3">Reth USDT</th>
            </tr>
          </thead>
          <tbody>
            {cashBalances.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">
                  {config?.cash_token_symbol ?? "USDT"}
                </td>
                <td className="px-4 py-3">0</td>
                <td className="px-4 py-3">0</td>
                <td className="px-4 py-3">0</td>
                <td className="px-4 py-3">{evmBalance}</td>
              </tr>
            ) : (
              cashBalances.map((b) => {
                const isCash =
                  b.symbol === (config?.cash_token_symbol ?? "USDT") ||
                  (config?.lp_token != null &&
                    b.token.toLowerCase() === config.lp_token.toLowerCase());
                return (
                  <tr key={b.token} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{b.symbol}</td>
                    <td className="px-4 py-3">{b.total}</td>
                    <td className="px-4 py-3">{b.locked}</td>
                    <td className="px-4 py-3">{b.available}</td>
                    <td className="px-4 py-3">{isCash ? evmBalance : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {dialog && (
        <AmountDialog
          kind={dialog}
          initialAmount={dialog === "deposit" ? "10" : "1"}
          busy={busy}
          progress={status}
          hint={pollHint}
          error={error}
          onClose={() => {
            if (!busy) {
              setDialog(null);
              setError(null);
              setStatus(null);
              setPollHint(null);
              setAwaitingMint(false);
              setAwaitingUnlock(false);
            }
          }}
          onConfirm={dialog === "deposit" ? onDeposit : onWithdraw}
        />
      )}

      {!dialog && status && (
        <div className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {status}
        </div>
      )}
      {!dialog && pollHint && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {pollHint}
        </div>
      )}
      {!dialog && error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
