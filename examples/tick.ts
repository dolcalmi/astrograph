// Live monitoring of best trade offers for specified asset pair
// Run: yarn exec ts-node examples/tick.ts

import { InMemoryCache } from "apollo-cache-inmemory";
import ApolloClient from "apollo-client";
import { WebSocketLink } from "apollo-link-ws";
import { gql } from "apollo-server";
import { SubscriptionClient } from "subscriptions-transport-ws";
import ws from "ws";

const GRAPHQL_ENDPOINT = "wss://astrograph.evilmartians.io/graphql"

const client = new SubscriptionClient(GRAPHQL_ENDPOINT, { reconnect: true, timeout: 60000 }, ws);
const link = new WebSocketLink(client);
const cache = new InMemoryCache();
const apolloClient = new ApolloClient({ link, cache });

console.log("Connecting to GraphQL...");

const SUBSCRIPTION = gql`
  subscription tick($selling: AssetID!, $buying: AssetID!) {
    tick(
      selling: $selling, 
      buying: $buying
    ) {
      bestBid
      bestAsk
    }    
  }
`;

apolloClient
  .subscribe({
    fetchPolicy: "network-only",
    query: SUBSCRIPTION,
    variables: {
      selling: "USD-GBSTRUSD7IRX73RQZBL3RQUH6KS3O4NYFY3QCALDLZD77XMZOPWAVTUK",
      buying: "native"
    }
  })
  .subscribe({
    next(data: any) {
      const values = data.data.tick;
      console.log(
        "BID/ASK:",
        `${values.bestBid}/${values.bestAsk}`
      );
    }
  });