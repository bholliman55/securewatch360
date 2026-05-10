import type { ValidationRunContext, ValidationStep, ValidationType } from "./remediationValidation.schema";
import { VALIDATION_TYPES } from "./remediationValidation.schema";

export type ValidationHandlerResult = {
  ok: boolean;
  message: string;
  evidence_ids?: string[];
};

export type ValidationHandler = (args: {
  step: ValidationStep;
  context: ValidationRunContext;
}) => Promise<ValidationHandlerResult>;

function stubMessage(type: ValidationType, context: ValidationRunContext): string {
  if (context.simulation_mode) return `[simulation] ${type} — fixture pass`;
  if (context.dry_run) return `[dry_run] ${type} — live verification skipped`;
  return `${type} — stub validator (wire scanner/ITSM adapters)`;
}

async function defaultStub(step: ValidationStep, context: ValidationRunContext): Promise<ValidationHandlerResult> {
  const simulated = context.dry_run || context.simulation_mode;
  return {
    ok: true,
    message: stubMessage(step.validation_type, context),
    evidence_ids: simulated ? [`evidence:sim:${step.validation_type}`] : [`evidence:${step.validation_type}`],
  };
}

/**
 * Registers validators per `ValidationType` — production registers real adapters (Tenable, IdP, PSA, etc.).
 */
export class ValidationRegistry {
  private readonly handlers = new Map<ValidationType, ValidationHandler>();

  constructor(seed?: Partial<Record<ValidationType, ValidationHandler>>) {
    for (const t of VALIDATION_TYPES) {
      this.handlers.set(t, seed?.[t] ?? ((args) => defaultStub(args.step, args.context)));
    }
  }

  register(type: ValidationType, handler: ValidationHandler): void {
    this.handlers.set(type, handler);
  }

  require(type: ValidationType): ValidationHandler {
    const h = this.handlers.get(type);
    if (!h) throw new Error(`unknown_validation_type:${type}`);
    return h;
  }
}

export function createDefaultValidationRegistry(): ValidationRegistry {
  return new ValidationRegistry();
}
