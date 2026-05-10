/**
 * Microsoft Teams workflow stub — real implementation should call Graph / incoming webhook with tenant-stored secrets.
 * No webhook URLs or tokens in source.
 */

import { MockSocAdapter } from "./mockSocAdapter";

export class TeamsSocStub extends MockSocAdapter {
  constructor() {
    super("microsoft_teams");
  }
}

export function createTeamsSocStub(): TeamsSocStub {
  return new TeamsSocStub();
}
