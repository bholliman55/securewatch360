import os from "os";

export async function collectNetworkInventory(): Promise<Record<string, unknown>> {
  const interfaces = os.networkInterfaces();
  const adapterEntries: Array<Record<string, unknown>> = [];
  const macSet = new Set<string>();

  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!addresses) continue;
    for (const address of addresses) {
      if (address.internal) continue;
      adapterEntries.push({
        interface: name,
        address: address.address,
        family: address.family,
        netmask: address.netmask,
        cidr: address.cidr,
        mac: address.mac,
        scopeid: address.scopeid,
      });

      if (address.mac) {
        macSet.add(address.mac);
      }
    }
  }

  return {
    interfaces: adapterEntries,
    macAddresses: [...macSet],
  };
}
