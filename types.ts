// Make jspdf, jspdf-autotable, xlsx, and JSZip available globally in TypeScript
// as they are loaded from a CDN.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jspdf: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JSZip: any;
}

// Define the structure for a single transaction
export interface Transaction {
  id: string; // Unique identifier
  date: string; // Format: 'DD/MM/YYYY'
  customerName: string;
  shopName: string;
  billType: 'withBill' | 'withoutBill';
  purpose: string;
  amountGiven: number;
}

// Define the structure for a single bill file
export interface Bill {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 encoded file data
  uploadedAt: string; // ISO string
}

// Map of bills, keyed by transaction ID
export interface BillMap {
  [transactionId: string]: Bill;
}

// Type for toast notifications
export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// This export is needed to make this a module and to allow global declarations.
export {};