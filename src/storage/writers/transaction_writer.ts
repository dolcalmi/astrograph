import { Transaction } from "../../model";
import { Connection } from "../connection";
import { Writer } from "./writer";

import * as nquads from "../nquads";

interface IContext {
  ledger: nquads.IValue;
  current: nquads.IValue;
  prev: nquads.IValue | null;
}

export class TransactionWriter extends Writer {
  private tx: Transaction;
  private context: IContext;

  constructor(connection: Connection, tx: Transaction, context: IContext) {
    super(connection);
    this.tx = tx;
    this.context = context;
  }

  public async write(): Promise<nquads.IValue> {
    const { current, prev } = this.context;

    this.appendRoot();
    this.appendTimeBounds();
    this.appendPrev(current, prev);
    this.appendMemo();

    await this.appendSourceAccount();

    const created = await this.push("transaction");
    return created || current;
  }

  private appendRoot() {
    const { ledger, current } = this.context;

    this.b
      .for(current)
      .append("type", "transaction")
      .append("id", this.tx.id)
      .append("index", this.tx.index)
      .append("seq", this.tx.ledgerSeq)
      .append("sortHandle", this.sortHandle())
      .append("feeAmount", this.tx.feeAmount);

    this.b.append(ledger, "transactions", current);
    this.b.append(current, "ledger", ledger);
  }

  private appendTimeBounds() {
    const timeBounds = this.tx.timeBounds;

    if (timeBounds) {
      this.b
        .for(this.context.current)
        .append("timeBoundMin", timeBounds[0])
        .append("timeBoundMax", timeBounds[1]);
    }
  }

  private appendMemo() {
    const memo = this.tx.memo;
    const { current } = this.context;

    if (!memo) {
      return;
    }

    const currentMemo =
      (current && current[0] && current[0].memo && nquads.UID.from(current[0].memo)) || new nquads.Blank("memo");

    this.b
      .for(currentMemo)
      .append("type", memo.type.toString())
      .append("value", memo.value)
      .append("transaction", current);

    this.b.append(current, "memo", currentMemo);
  }

  private async appendSourceAccount() {
    const { current } = this.context;
    const sourceAccount = await this.accountCache.fetch(this.tx.sourceAccount);

    this.b.append(current, "sourceAccountID", this.tx.sourceAccount);
    this.b.append(current, "sourceAccount", sourceAccount);
    this.b.append(sourceAccount, "transactions", current);
  }

  private sortHandle(): string {
    return `${this.tx.ledgerSeq}-${this.tx.index}`;
  }
}
