// Shape of `plans.features` (JSONB, platform CMS data — ERD.md §1). The keys below are
// static (code reads them with `if`); the boolean values per plan are CMS data in Neon.

export interface PlanFeatures {
  export_xlsx: boolean;
  export_pdf: boolean;
  email_alerts: boolean;
  whatsapp_alerts: boolean;
  template_override: boolean;
}

export const DEFAULT_PLAN_FEATURES: PlanFeatures = {
  export_xlsx: true,
  export_pdf: false,
  email_alerts: false,
  whatsapp_alerts: false,
  template_override: false,
};

export function parsePlanFeatures(value: unknown): PlanFeatures {
  const v = (value ?? {}) as Partial<PlanFeatures>;
  return {
    export_xlsx: Boolean(v.export_xlsx),
    export_pdf: Boolean(v.export_pdf),
    email_alerts: Boolean(v.email_alerts),
    whatsapp_alerts: Boolean(v.whatsapp_alerts),
    template_override: Boolean(v.template_override),
  };
}
