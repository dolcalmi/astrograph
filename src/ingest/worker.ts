import { Publisher } from "../pubsub";
import { Cursor } from "./cursor";

import { SubscriptionPayloadCollection } from "./subscription_payload_collection";

import { Connection, Store } from "../storage";
import { DGRAPH_URL } from "../util/secrets";
// import logger from "../util/logger";

export class Worker {
  public cursor: Cursor;

  constructor(cursor: Cursor) {
    this.cursor = cursor;
  }

  public async run() {
    const result = await this.cursor.nextLedger();

    if (result) {
      const { header, transactions } = result;

      const collection = new SubscriptionPayloadCollection(transactions);
      await Publisher.publish(header, collection);

      if (DGRAPH_URL) {
        const connection = new Connection();
        const store = new Store(connection);
        const ledger = await store.ledger(header);

        for (const transaction of transactions) {
          const tx = await store.transaction(transaction, { ledger });

          const ops = transaction.operationsXDR();
          for (let index = 0; index < ops.length; index++) {
            const op = ops[index];

            await store.operation(transaction, op, index, { ledger, tx });
          }
        }

        connection.close();
      }
    }
  }
}
