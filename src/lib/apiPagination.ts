export type ParsedPagination =
  | {
      ok: true;
      limit: number;
      offset: number;
    }
  | {
      ok: false;
      error: string;
    };

export function parsePagination(args: {
  rawLimit: string | null | undefined;
  rawOffset: string | null | undefined;
  defaultLimit: number;
  maxLimit: number;
}): ParsedPagination {
  const limitRaw = args.rawLimit?.trim() ?? "";
  const offsetRaw = args.rawOffset?.trim() ?? "";

  const limit = limitRaw.length > 0 ? Number(limitRaw) : args.defaultLimit;
  if (!Number.isInteger(limit) || limit < 1 || limit > args.maxLimit) {
    return { ok: false, error: `limit must be an integer between 1 and ${args.maxLimit}` };
  }

  const offset = offsetRaw.length > 0 ? Number(offsetRaw) : 0;
  if (!Number.isInteger(offset) || offset < 0) {
    return { ok: false, error: "offset must be an integer greater than or equal to 0" };
  }

  return { ok: true, limit, offset };
}

