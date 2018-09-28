import db from "../database";
import { Ledger, Transaction } from "../model";
import { Collection } from "./collection";

export class Fetcher {
  public ledger: Ledger;

  constructor(ledger: Ledger) {
    this.ledger = ledger;
  }

  public async fetch(): Promise<Collection> {
    const collection = new Collection();

    const transactions = await db.transactions.findAllBySeq(this.ledger.seq);

    const fees = this.fetchFees(transactions);
    const changes = this.fetchChanges(transactions);

    collection.concatXDR(fees);
    collection.concatXDR(changes);

    return collection;
  }

  private fetchFees(transactions: Transaction[]): any[] {
    const result: any[] = [];

    for (const tx of transactions) {
      result.push(...tx.feeMetaFromXDR().changes());
    }

    return result;
  }

  private fetchChanges(transactions: Transaction[]): any[] {
    const result: any[] = [];

    for (const tx of transactions) {
      const xdr = tx.metaFromXDR();

      switch (xdr.switch()) {
        case 0:
          for (const op of xdr.operations()) {
            result.push(...op.changes());
          }
          break;
        case 1:
          result.push(...xdr.v1().txChanges());
          for (const op of xdr.v1().operations()) {
            result.push(...op.changes());
          }
          break;
      }
    }

    return result;
  }
}
