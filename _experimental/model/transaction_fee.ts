import stellar from "stellar-base";

export class TransactionFee {
  public transactionID: string;
  public ledgerSeq: number;
  public index: number;
  public changes: string;

  constructor(data: { txid: string; ledgerseq: number; txindex: number; txchanges: string }) {
    this.transactionID = data.txid;
    this.ledgerSeq = data.ledgerseq;
    this.index = data.txindex;
    this.changes = data.txchanges;
  }

  public changesFromXDR() {
    return stellar.xdr.OperationMeta.fromXDR(Buffer.from(this.changes, "base64"));
  }
}
