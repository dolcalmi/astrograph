import { Transaction } from "../../model";
import { Connection } from "../connection";
import { RecurseIterator } from "../recurse_iterator";
import { Writer } from "./writer";

import * as nquads from "../nquads";

export interface IArgs {
  ledger: nquads.IValue;
}

interface IContext extends IArgs {
  current: nquads.IValue;
  prev: nquads.IValue | null;
}

export class TransactionWriter extends Writer {
  public static async write(connection: Connection, tx: Transaction, args: IArgs): Promise<nquads.IValue> {
    const ledger = args.ledger;
    const context = await this.queryContext(connection, ledger.value, tx.id);

    const current = nquads.UID.from(context.current) || new nquads.Blank("transaction");

    const prevTransaction = this.findPrevTransaction(context.prevTree, tx);
    const prev = nquads.UID.from(prevTransaction);

    return new TransactionWriter(connection, tx, { ledger, current, prev }).write();
  }

  // Returns prev and next ledger uids, ledger sequence is contniuous, must not contain gaps.
  // It is primary criteria for prev/next indexing of all objects in graph.
  private static queryContext(connection: Connection, ledger: string, id: string): Promise<any> {
    return connection.query(
      `
        query context($id: string, $ledger: string) {
          prevTree(func: uid($ledger), orderdesc: seq) @recurse(depth: 20, loop: true) {
            uid
            index
            seq

            transactions(orderdesc: index) {
              uid
              index
            }

            prev
          }

          current(func: eq(type, "transaction"), first: 1) @filter(eq(id, $id)) {
            uid
            memo {
              uid
            }
          }
        }
      `,
      {
        $ledger: ledger,
        $id: id
      }
    );
  }

  private static findPrevTransaction(prevTree: any, tx: Transaction) {
    return new RecurseIterator(prevTree, "prev", "transactions")
      .find(this.matchTransaction(tx.seq, tx.index));
  }

  private static matchTransaction(seq: number, index: number): any {
    return (txs: any): any => {
      const tx = value.find((tx: any) => {
        const sameLedger = tx.seq === seq;
        const prevIndex = tx.index === index - 1;

        return (sameLedger && prevIndex) || !sameLedger;
      });

      return tx;
    }
  }

  private tx: Transaction;
  private context: IContext;

  constructor(connection: Connection, tx: Transaction, args: IContext) {
    super(connection);
    this.tx = tx;
    this.context = context;
  }

  public async write(): Promise<nquads.IValue> {
    const { prevTree, current } = await this.queryContext();
    const uid = this.newOrUID(current, "transaction");
    const prev = this.findPrev(prevTree);

    let nquads = this.baseNQuads(uid);
    nquads += this.prevNQuads(uid, prev);
    nquads += this.memoNQuads(uid, current);
    nquads += this.timeBoundsNQuads(uid);
    nquads += await this.accountsNQuads(uid);

    const result = await this.connection.push(nquads);
    return result.getUidsMap().get("transaction") || current[0].uid;
  }

  // Returns prev/next transactions within ledger.
  //
  // We assume that all ledgers are ingested in full, including all underlying transactions, operations
  // and all other entities.
  //
  // prevTree finds previous lastest transaction within linked list of ledgers and ensures the chain is
  // consistent. For example, if you have ingested ledgers 100-200 and then decide to ingest ledgers 500-600,
  // first transaction from ledger 500 should have blank previous transaction because it is missing in database.
  //
  // `depth` sets the maximum number of ledgers in row containing zero transactions.
  private async queryContext(): Promise<any> {
    return this.connection.query(
      `
        query context($id: string, $ledger: string) {
          prevTree(func: uid($ledger), orderdesc: seq) @recurse(depth: 20, loop: true) {
            uid
            index
            seq

            transactions(orderdesc: index) {
              uid
              index
            }

            prev
          }

          current(func: eq(type, "transaction"), first: 1) @filter(eq(id, $id)) {
            uid
            memo {
              uid
            }
          }
        }
      `,
      {
        $ledger: this.uid.ledger,
        $id: this.tx.id
      }
    );
  }

  private baseNQuads(uid: string): string {
    return `
      ${uid} <type> "transaction" .
      ${uid} <id> "${this.tx.id}" .
      ${uid} <index> "${this.tx.index}" .
      ${uid} <seq> "${this.tx.ledgerSeq}" .
      ${uid} <sortHandle> "${this.sortHandle()}" .
      ${uid} <feeAmount> "${this.tx.feeAmount}" .
      ${uid} <sourceAccountID> "${this.tx.sourceAccount}" .

      <${this.uid.ledger}> <transactions> ${uid} .
      ${uid} <ledger> <${this.uid.ledger}> .
    `;
  }

  private memoNQuads(uid: string, current: any): string {
    const memo = this.tx.memo;

    if (!memo) {
      return "";
    }

    const memoUID =
      current && current[0] && current[0].memo && current[0].memo[0] ? `<${current[0].memo[0].uid}>` : "_:memo";

    const s = `
      ${memoUID} <type> "${memo.type.toString()}" .
      ${memoUID} <value> "${memo.value}" .

      ${uid} <memo> ${memoUID} .
      ${memoUID} <transaction> ${uid} .
    `;

    return s;
  }

  private timeBoundsNQuads(uid: string): string {
    if (!this.tx.timeBounds) {
      return "";
    }

    return `
      ${uid} <time_bound_min> "${this.tx.timeBounds[0]}" .
      ${uid} <time_bound_max> "${this.tx.timeBounds[1]}" .
    `;
  }

  private sortHandle(): string {
    return `${this.tx.ledgerSeq}-${this.tx.index}`;
  }

  private async accountsNQuads(uid: string): Promise<string> {
    const sourceAccount = await this.accountCache.fetch(this.tx.sourceAccount);

    return `
      ${uid} <sourceAccount> ${sourceAccount} .
      ${sourceAccount} <transactions> ${uid} .
    `;
  }

  private findPrev(tree: any): string | null {
    return this.walk(tree[0], (data: any) => {
      if (data === null) {
        return null;
      }

      const txs = data.transactions || [];
      const result = txs.find((tx: any) => {
        const sameLedger = tx.seq === this.tx.ledgerSeq;
        const prevIndex = tx.index === this.tx.index - 1;

        return (sameLedger && prevIndex) || !sameLedger;
      });

      const leaf = data.prev && data.prev[0] ? data.prev[0] : null;

      return { leaf, result };
    });
  }
}