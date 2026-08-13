export interface DetectedXrplTx {
  txHash: string;
  sourceAddress: string;
  destinationAddress: string;
  amountDrops: string;
  memoInvoiceId: string;
  blockNumber: number;
  blockTimestamp: number;
}

export interface XrplMonitorOptions {
  wssUrl: string;
  accounts: string[];
  onPaymentDetected: (tx: DetectedXrplTx) => void;
  onError?: (err: Error) => void;
}

export class XrplMonitor {
  private ws: WebSocket | null = null;
  private isRunning = false;

  constructor(private options: XrplMonitorOptions) {}

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      this.ws = new WebSocket(this.options.wssUrl);

      this.ws.onopen = () => {
        if (this.options.accounts.length > 0) {
          const subscribeReq = {
            command: 'subscribe',
            accounts: this.options.accounts,
          };
          this.ws?.send(JSON.stringify(subscribeReq));
        } else {
          // Subscribe to all ledger transactions if no account filter specified
          const subscribeReq = {
            command: 'subscribe',
            streams: ['transactions'],
          };
          this.ws?.send(JSON.stringify(subscribeReq));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString());
          const tx = data.transaction || data.tx_json;

          if (data.type === 'transaction' && data.validated && tx && tx.TransactionType === 'Payment') {
            const memos = tx.Memos || [];
            if (memos.length > 0) {
              const memoData = memos[0]?.Memo?.MemoData;
              if (memoData) {
                const invoiceId = memoData.startsWith('0x') ? memoData : `0x${memoData}`;
                const amountDrops =
                  typeof tx.Amount === 'string' ? tx.Amount : tx.Amount?.value || '0';

                this.options.onPaymentDetected({
                  txHash: tx.hash,
                  sourceAddress: tx.Account,
                  destinationAddress: tx.Destination,
                  amountDrops,
                  memoInvoiceId: invoiceId,
                  blockNumber: data.ledger_index || tx.ledger_index || 1000,
                  blockTimestamp: tx.date ? tx.date + 946684800 : Math.floor(Date.now() / 1000),
                });
              }
            }
          }
        } catch (e) {
          // Ignore invalid parse
        }
      };

      this.ws.onerror = (err) => {
        if (this.options.onError) {
          this.options.onError(new Error('XRPL Monitor WebSocket Error'));
        }
      };
    } catch (err: any) {
      if (this.options.onError) {
        this.options.onError(err);
      }
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
