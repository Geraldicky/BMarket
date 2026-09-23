export interface MidtransItemDetail {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

export interface MidtransSnapRequest {
  transaction_details: { order_id: string; gross_amount: number };
  customer_details: { first_name: string; email: string; phone?: string };
  item_details: MidtransItemDetail[];
  credit_card: { secure: true };
  expiry: { start_time: string; duration: number; unit: 'minutes' };
  page_expiry: { duration: number; unit: 'minutes' };
  callbacks?: { finish: string };
}

export interface MidtransSnapResponse {
  token: string;
  redirect_url: string;
}

export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
  settlement_time?: string;
  transaction_time?: string;
}

export interface MidtransStatus extends Omit<MidtransNotification, 'signature_key'> {
  signature_key?: string;
  status_message?: string;
}
