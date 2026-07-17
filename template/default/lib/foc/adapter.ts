"use client";

import "viem/window";
import {
  Synapse,
  calibration,
  mainnet,
  type PieceCID,
  type UploadResult,
} from "@filoz/synapse-sdk";
import { custom, isAddress, type Address } from "viem";

import type {
  FocNetwork,
  FocReceipt,
  FocSession,
  PrepareReceipt,
  VerificationReceipt,
} from "./types";
import { equalBytes } from "./verify";

const SOURCE = "create-foc-app";
const TEMPLATE_DEFAULT_NETWORK: FocNetwork = "__FOC_NETWORK__";

export function configuredNetwork(): FocNetwork {
  const configured = process.env.NEXT_PUBLIC_FILECOIN_NETWORK;
  if (configured === "mainnet" || configured === "calibration") {
    return configured;
  }

  return TEMPLATE_DEFAULT_NETWORK;
}

function requireInjectedWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected EIP-1193 wallet found. Install a wallet such as MetaMask and refresh.");
  }

  return window.ethereum;
}

function errorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = Number(error.code);
  return Number.isFinite(code) ? code : undefined;
}

async function switchToChain(
  provider: ReturnType<typeof requireInjectedWallet>,
  chain: typeof mainnet | typeof calibration,
): Promise<void> {
  const chainId = `0x${chain.id.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    if (errorCode(error) !== 4902) {
      throw error;
    }

    const explorerUrl = chain.blockExplorers?.default.url;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId,
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: [...chain.rpcUrls.default.http],
        ...(explorerUrl ? { blockExplorerUrls: [explorerUrl] } : {}),
      }],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  }
}

type WalletEventProvider = ReturnType<typeof requireInjectedWallet> & {
  on?: (event: "accountsChanged" | "chainChanged", listener: () => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", listener: () => void) => void;
};

export function subscribeWalletChanges(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.ethereum) {
    return () => undefined;
  }

  const provider = window.ethereum as WalletEventProvider;
  provider.on?.("accountsChanged", onChange);
  provider.on?.("chainChanged", onChange);

  return () => {
    provider.removeListener?.("accountsChanged", onChange);
    provider.removeListener?.("chainChanged", onChange);
  };
}

export async function connectWallet(): Promise<FocSession> {
  const provider = requireInjectedWallet();
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = accounts[0];

  if (!address || !isAddress(address)) {
    throw new Error("The wallet did not return a valid account address.");
  }

  const network = configuredNetwork();
  const chain = network === "mainnet" ? mainnet : calibration;
  const expectedChainId = `0x${chain.id.toString(16)}`;
  const currentChainId = await provider.request({ method: "eth_chainId" });

  if (currentChainId.toLowerCase() !== expectedChainId.toLowerCase()) {
    try {
      await switchToChain(provider, chain);
    } catch (error) {
      throw new Error(
        `Switch the wallet to Filecoin ${network} (chain ${chain.id}) and reconnect.`,
        { cause: error },
      );
    }
  }

  const synapse = Synapse.create({
    account: address as Address,
    transport: custom(provider),
    chain,
    source: SOURCE,
  });

  return { address: address as Address, network, synapse };
}

export async function prepareStorage(
  session: FocSession,
  byteLength: number,
  onHash?: (hash: string) => void,
): Promise<PrepareReceipt> {
  const prepared = await session.synapse.storage.prepare({
    dataSize: BigInt(byteLength),
  });

  const receipt: PrepareReceipt = {
    dataSize: byteLength,
    readyBeforeTransaction: prepared.costs.ready,
    depositNeeded: prepared.costs.depositNeeded.toString(),
    includesApproval: prepared.transaction?.includesApproval ?? false,
  };

  if (prepared.transaction) {
    const result = await prepared.transaction.execute({
      onHash: (hash) => onHash?.(hash),
    });
    receipt.transactionHash = result.hash;
  }

  return receipt;
}

function normalizeUploadResult(result: UploadResult): FocReceipt {
  return {
    pieceCid: result.pieceCid.toString(),
    size: result.size,
    complete: result.complete,
    requestedCopies: result.requestedCopies,
    copies: result.copies.map((copy) => ({
      providerId: copy.providerId.toString(),
      dataSetId: copy.dataSetId.toString(),
      pieceId: copy.pieceId.toString(),
      role: copy.role,
      retrievalUrl: copy.retrievalUrl,
      isNewDataSet: copy.isNewDataSet,
    })),
    failedAttempts: result.failedAttempts.map((attempt) => ({
      providerId: attempt.providerId.toString(),
      role: attempt.role,
      error: attempt.error,
      explicit: attempt.explicit,
    })),
  };
}

export async function uploadPayload(
  session: FocSession,
  data: Uint8Array,
): Promise<FocReceipt> {
  const result = await session.synapse.storage.upload(data, {
    copies: 2,
    pieceMetadata: {
      filename: "foc-demo.txt",
      contentType: "text/plain",
    },
  });

  return normalizeUploadResult(result);
}

export async function retrieveAndVerify(
  session: FocSession,
  pieceCid: string,
  original: Uint8Array,
): Promise<VerificationReceipt> {
  const downloaded = await session.synapse.storage.download({
    pieceCid: pieceCid as unknown as PieceCID,
  });

  return {
    pieceCid,
    byteLength: downloaded.byteLength,
    matchesOriginal: equalBytes(downloaded, original),
  };
}
