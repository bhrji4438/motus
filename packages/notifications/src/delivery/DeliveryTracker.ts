import crypto from "crypto";
import {
  NotificationPayload,
  NotificationResult,
} from "@/providers/INotificationProvider.js";

export interface DeliveryReceipt {
  receiptId: string;
  tenantId: string;
  recipientId: string;
  title: string;
  body: string;
  channel: string;
  status: "pending" | "success" | "failed";
  attempts: NotificationResult[];
  createdAt: string;
  updatedAt: string;
}

export interface IDeliveryTracker {
  createReceipt(
    tenantId: string,
    payload: NotificationPayload,
    channel: string
  ): Promise<DeliveryReceipt>;
  recordAttempt(
    receiptId: string,
    result: NotificationResult
  ): Promise<DeliveryReceipt>;
  getReceipt(receiptId: string): Promise<DeliveryReceipt | undefined>;
  getTenantStats(
    tenantId: string
  ): Promise<{ total: number; success: number; failed: number }>;
}

export class InMemoryDeliveryTracker implements IDeliveryTracker {
  private receipts = new Map<string, DeliveryReceipt>();

  public async createReceipt(
    tenantId: string,
    payload: NotificationPayload,
    channel: string
  ): Promise<DeliveryReceipt> {
    const receiptId = `rcpt-${crypto.randomUUID()}`;
    const receipt: DeliveryReceipt = {
      receiptId,
      tenantId,
      recipientId: payload.recipientId,
      title: payload.title,
      body: payload.body,
      channel,
      status: "pending",
      attempts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.receipts.set(receiptId, receipt);
    return receipt;
  }

  public async recordAttempt(
    receiptId: string,
    result: NotificationResult
  ): Promise<DeliveryReceipt> {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) {
      throw new Error(`Delivery receipt with ID '${receiptId}' not found`);
    }

    receipt.attempts.push(result);
    receipt.status = result.success ? "success" : "failed";
    receipt.updatedAt = new Date().toISOString();

    this.receipts.set(receiptId, receipt);
    return receipt;
  }

  public async getReceipt(
    receiptId: string
  ): Promise<DeliveryReceipt | undefined> {
    return this.receipts.get(receiptId);
  }

  public async getTenantStats(
    tenantId: string
  ): Promise<{ total: number; success: number; failed: number }> {
    let total = 0;
    let success = 0;
    let failed = 0;

    for (const receipt of this.receipts.values()) {
      if (receipt.tenantId === tenantId) {
        total++;
        if (receipt.status === "success") {
          success++;
        } else if (receipt.status === "failed") {
          failed++;
        }
      }
    }

    return { total, success, failed };
  }
}
