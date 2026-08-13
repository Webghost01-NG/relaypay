import { XRPLTransactionEvent } from './types.js';

export interface XRPLListenerOptions {
  wssUrl: string;
  destinationAddress: string;
  memoInvoiceId: string;
  onPaymentDetected: (event: XRPLTransactionEvent) => void;
  onError?: (err: Error) => void;
}

/**
 * Monitors the XRPL ledger in real-time for incoming payment transactions bound to a specific invoice memo
 */
export class XRPLPaymentListener {
  private ws: WebSocket | null = null;
  private isListening = false;

  constructor(private options: XRPLListenerOptions) {}

  public start(): void {
    if (this.isListening) return;
    this.isListening = true;

    try {
      // Create WebSocket connection (works in Browser & Node 22+)
      this.ws = new WebSocket(this.options.wssUrl);

      this.ws.onopen = () => {
        // Subscribe to account transactions on XRPL
        const subscribeReq = {
          command: 'subscribe',
          accounts: [this.options.destinationAddress],
        };
        this.ws?.send(JSON.stringify(subscribeReq));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString());
          if (data.type === 'transaction' && data.validated) {
            const tx = data.transaction;
            if (
              tx &&
              tx.TransactionType === 'Payment' &&
              tx.Destination === this.options.destinationAddress
            ) {
              // Extract memo
              const memos = tx.Memos || [];
              const matchedMemo = memos.find(
                (m: any) =>
                  m.Memo?.MemoData?.toUpperCase() ===
                  this.options.memoInvoiceId.replace(/^0x/i, '').toUpperCase()
              );

              if (matchedMemo || memos.length === 0) {
                const amountDrops =
                  typeof tx.Amount === 'string'
                    ? tx.Amount
                    : tx.Amount?.value || '0';

                this.options.onPaymentDetected({
                  txHash: tx.hash,
                  sourceAddress: tx.Account,
                  destinationAddress: tx.Destination,
                  amountDrops,
                  memoInvoiceId: this.options.memoInvoiceId,
                  blockTimestamp: tx.date ? tx.date + 946684800 : Math.floor(Date.now() / 1000),
                });
              }
            }
          }
        } catch (e) {
          // Parse error ignore
        }
      };

      this.ws.onerror = (err) => {
        if (this.options.onError) {
          this.options.onError(new Error('XRPL WebSocket Error'));
        }
      };
    } catch (err: any) {
      if (this.options.onError) {
        this.options.onError(err);
      }
    }
  }

  public stop(): void {
    this.isListening = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
