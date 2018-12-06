import _ from "lodash";
import { Connection } from "../../storage/connection";
import { OperationsQuery } from "../../storage/queries/operations";
import { OperationKinds } from "../../storage/queries/operations/types";

export default {
  IOperation: {
    __resolveType(obj: any, context: any, info: any) {
      if (obj.kind === OperationKinds.Payment) {
        return "PaymentOperation";
      }

      if (obj.kind === OperationKinds.SetOption) {
        return "SetOptionsOperation";
      }

      return null;
    }
  },
  Query: {
    operations(root: any, args: any, ctx: any, info: any) {
      const { account, first, offset, filters } = args;
      const conn = new Connection();

      const query = new OperationsQuery(conn, account, filters, first, offset);

      return query.call();
    }
  }
};
