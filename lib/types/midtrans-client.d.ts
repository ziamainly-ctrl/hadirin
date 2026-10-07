// Minimal ambient types for `midtrans-client` (TRD.md §3), which ships no type
// declarations of its own and has no corresponding @types package. Covers only the
// Snap surface lib/midtrans.ts actually calls — extend as more of the API is used.
declare module 'midtrans-client' {
  export interface SnapOptions {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  export interface CreateTransactionParameter {
    transaction_details: {
      order_id: string;
      gross_amount: number;
    };
    enabled_payments?: string[];
    customer_details?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
    };
    [key: string]: unknown;
  }

  export interface CreateTransactionResponse {
    token: string;
    redirect_url: string;
    [key: string]: unknown;
  }

  export class Snap {
    constructor(options: SnapOptions);
    createTransaction(parameter: CreateTransactionParameter): Promise<CreateTransactionResponse>;
    createTransactionToken(parameter: CreateTransactionParameter): Promise<string>;
    createTransactionRedirectUrl(parameter: CreateTransactionParameter): Promise<string>;
  }

  export class CoreApi {
    constructor(options: SnapOptions);
  }

  interface MidtransClient {
    Snap: typeof Snap;
    CoreApi: typeof CoreApi;
  }

  const midtransClient: MidtransClient;
  export default midtransClient;
}
