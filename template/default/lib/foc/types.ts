import type { Synapse } from "@filoz/synapse-sdk";
import type { Address } from "viem";

export type FocNetwork = "calibration" | "mainnet";

export interface FocSession {
  address: Address;
  network: FocNetwork;
  synapse: Synapse;
}

export interface PrepareReceipt {
  dataSize: number;
  readyBeforeTransaction: boolean;
  depositNeeded: string;
  includesApproval: boolean;
  transactionHash?: string;
}

export interface FocCopyReceipt {
  providerId: string;
  dataSetId: string;
  pieceId: string;
  role: "primary" | "secondary";
  retrievalUrl: string;
  isNewDataSet: boolean;
}

export interface FocReceipt {
  pieceCid: string;
  size: number;
  complete: boolean;
  requestedCopies: number;
  copies: FocCopyReceipt[];
  failedAttempts: Array<{
    providerId: string;
    role: "primary" | "secondary";
    error: string;
    explicit: boolean;
  }>;
}

export interface VerificationReceipt {
  pieceCid: string;
  byteLength: number;
  matchesOriginal: boolean;
}
