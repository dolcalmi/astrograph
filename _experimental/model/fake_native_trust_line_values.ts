import stellar from "stellar-base";
import { TrustLine } from "./trust_line";

import { MAX_INT64 } from "../util";
import { NATIVE_ASSET_CODE, NETWORK_MASTER_KEY } from "../util/stellar";
import { publicKeyFromXDR } from "../util/xdr";

export class FakeNativeTrustLineValues extends TrustLine {
  public static buildFromXDR(xdr: any): FakeNativeTrustLineValues { 
    return new FakeNativeTrustLineValues({
      accountid: publicKeyFromXDR(xdr),
      assettype: stellar.xdr.AssetType.assetTypeNative().value,
      assetcode: NATIVE_ASSET_CODE,
      issuer: NETWORK_MASTER_KEY,
      lastmodified: -1,
      tlimit: MAX_INT64,
      flags: 1,
      balance: xdr.balance().toString()
    });
  }
}
