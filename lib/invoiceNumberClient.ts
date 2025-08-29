// Client-safe invoice number utilities
// These functions don't require Firebase Admin and can run in the browser

// Get invoice number from existing order
export const getInvoiceNumber = (order: any): string => {
  return order.invoiceNumber || order.invoice_number || 'N/A';
};

// Format invoice number for display
export const formatInvoiceNumber = (invoiceNumber: string): string => {
  if (!invoiceNumber || invoiceNumber === 'N/A') {
    return 'N/A';
  }
  return invoiceNumber;
};
