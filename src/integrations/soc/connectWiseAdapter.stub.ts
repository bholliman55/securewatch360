/**
 * ConnectWise Manage / PSA stub — swap for HTTP client that reads tenant OAuth config from secret store.
 * No credentials or base URLs are embedded here.
 */

import { MockSocAdapter } from "./mockSocAdapter";

export class ConnectWiseSocStub extends MockSocAdapter {
  constructor() {
    super("connectwise_psa");
  }
}

export function createConnectWiseSocStub(): ConnectWiseSocStub {
  return new ConnectWiseSocStub();
}
