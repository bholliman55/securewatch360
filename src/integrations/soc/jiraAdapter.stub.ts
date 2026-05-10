/**
 * Jira Service Management / Jira Software stub — replace with REST client using scoped API tokens per tenant.
 * No API secrets in repository code.
 */

import { MockSocAdapter } from "./mockSocAdapter";

export class JiraSocStub extends MockSocAdapter {
  constructor() {
    super("jira");
  }
}

export function createJiraSocStub(): JiraSocStub {
  return new JiraSocStub();
}
