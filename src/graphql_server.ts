import init from "./init";

import * as Sentry from "@sentry/node";

import { ApolloServer } from "apollo-server";
import { GraphQLError } from "graphql";

import {
  HorizonAssetsDataSource,
  HorizonEffectsDataSource,
  HorizonOrderBookDataSource,
  HorizonPathFindingDataSource,
  HorizonTradesDataSource,
  HorizonTransactionsDataSource
} from "./datasource/horizon";
import schema from "./schema";
import { OperationsStorage } from "./storage/operations";
import logger from "./util/logger";
import { BIND_ADDRESS, PORT } from "./util/secrets";
import { listenBaseReserveChange } from "./util/stellar";

const demoQuery = `{
  account(id: "GB6NVEN5HSUBKMYCE5ZOWSK5K23TBWRUQLZY3KNMXUZ3AQ2ESC4MY4AQ") {
    id
    sequenceNumber
    balances {
      asset {
        native
        issuer {
          id
        }
        code
      }
      balance
      limit
      authorized
    }
    signers {
      signer
      weight
    }
  }
}`;

const endpoint = "/graphql";

/* tslint:disable */
type DataSources = {
  assets: HorizonAssetsDataSource;
  effects: HorizonEffectsDataSource;
  orderBook: HorizonOrderBookDataSource;
  pathfinding: HorizonPathFindingDataSource;
  trades: HorizonTradesDataSource;
  transactions: HorizonTransactionsDataSource;
};

export interface IApolloContext {
  storage: { operations: OperationsStorage };
  dataSources: DataSources;
}

init().then(() => {
  listenBaseReserveChange();

  const server = new ApolloServer({
    schema,
    tracing: true,
    introspection: true,
    playground: process.env.NODE_ENV === "production" ? { endpoint, tabs: [{ endpoint, query: demoQuery }] } : true,
    debug: true,
    cors: true,
    context: () => {
      return {
        storage: {
          operations: new OperationsStorage()
        }
      };
    },
    dataSources: (): DataSources => {
      return {
        assets: new HorizonAssetsDataSource(),
        effects: new HorizonEffectsDataSource(),
        orderBook: new HorizonOrderBookDataSource(),
        pathfinding: new HorizonPathFindingDataSource(),
        trades: new HorizonTradesDataSource(),
        transactions: new HorizonTransactionsDataSource()
      };
    },
    formatError: (error: GraphQLError) => {
      logger.error(error);

      if (!error.originalError || error.originalError.constructor.name !== "UserInputError") {
        Sentry.captureException(error);
      }

      return new GraphQLError(
        error.message,
        error.nodes,
        error.source,
        error.positions,
        error.path,
        error,
        error.extensions
      );
    }
  });

  server.listen({ port: PORT, host: BIND_ADDRESS }).then(({ url }) => {
    logger.info(`🚀 Server ready at ${url}`);
  });
});
