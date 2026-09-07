import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';

vi.mock('../../services/api', () => ({
  getSuppliers: vi.fn(),
  getPurchaseOrders: vi.fn(),
  getProducts: vi.fn(),
  createSupplier: vi.fn(),
  createPurchaseOrder: vi.fn(),
  receivePurchaseOrder: vi.fn(),
  createSupplierPayment: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const {
  getSuppliers, getPurchaseOrders, getProducts,
  createPurchaseOrder, receivePurchaseOrder, createSupplierPayment
} = await import('../../services/api');
const AdminSuppliers = (await import('./AdminSuppliers.jsx')).default;

const suppliers = [
  { _id: 's1', name: 'Krishna Distributors', mobile: '9876543210', gstNumber: 'GST001', balance: 500, status: 'active' },
  { _id: 's2', name: 'Metro Wholesale', mobile: '9123456789', balance: 0, status: 'active' }
];

const pos = [
  { _id: 'p1', poNumber: 'PO20250100001', supplier: { name: 'Krishna Distributors' }, items: [{}, {}], totalAmount: 800, status: 'pending' },
  { _id: 'p2', poNumber: 'PO20250100002', supplier: { name: 'Metro Wholesale' }, items: [{}], totalAmount: 300, status: 'received' }
];

const products = [
  { _id: 'pr1', name: 'Basmati Rice', unit: 'kg', price: 120, wholesalePrice: 100, status: 'active' },
  { _id: 'pr2', name: 'Toor Dal', unit: 'kg', price: 150, wholesalePrice: 130, status: 'active' }
];

async function renderPage() {
  render(<AdminSuppliers />);
  await waitFor(() => expect(screen.getByText('Krishna Distributors')).toBeInTheDocument());
}

describe('AdminSuppliers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSuppliers.mockResolvedValue({ data: { data: suppliers } });
    getPurchaseOrders.mockResolvedValue({ data: { data: pos } });
    getProducts.mockResolvedValue({ data: { data: products } });
    receivePurchaseOrder.mockResolvedValue({ data: { success: true } });
    createPurchaseOrder.mockResolvedValue({ data: { success: true } });
    createSupplierPayment.mockResolvedValue({ data: { success: true } });
  });

  it('renders suppliers, PO list, and a Receive button only for non-received POs', async () => {
    await renderPage();

    expect(screen.getByText('Metro Wholesale')).toBeInTheDocument();
    expect(screen.getByText(/PO20250100001/)).toBeInTheDocument();
    expect(screen.getByText(/PO20250100002/)).toBeInTheDocument();

    const receiveButtons = screen.getAllByText('Receive PO');
    expect(receiveButtons).toHaveLength(1);
  });

  it('receives a pending PO and refreshes the list', async () => {
    await renderPage();

    fireEvent.click(screen.getByText('Receive PO'));

    await waitFor(() => {
      expect(receivePurchaseOrder).toHaveBeenCalledWith('p1');
    });
    expect(toast.success).toHaveBeenCalledWith('PO received — stock updated');
    expect(getPurchaseOrders).toHaveBeenCalledTimes(2);
  });

  it('creates a purchase order with product items via the modal', async () => {
    await renderPage();

    fireEvent.click(screen.getByText('Create PO'));
    expect(screen.getByText('Create Purchase Order')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Supplier *'), { target: { value: 's1' } });
    fireEvent.click(screen.getByText('+ Add item'));

    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'pr1' } });
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('₹/unit'), { target: { value: '100' } });

    expect(screen.getByText('₹1,000')).toBeInTheDocument();

    const submitPo = screen.getAllByRole('button', { name: 'Create PO' }).find(b => b.getAttribute('type') === 'submit');
    fireEvent.click(submitPo);

    await waitFor(() => {
      expect(createPurchaseOrder).toHaveBeenCalledWith({
        supplierId: 's1',
        items: [{ product: 'pr1', quantity: 10, unitPrice: 100 }],
        expectedDelivery: undefined,
        notes: undefined
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Purchase order created');
  });

  it('records a supplier payment from the suppliers directory', async () => {
    await renderPage();

    const payButtons = screen.getAllByRole('button', { name: /Pay/ });
    expect(payButtons).toHaveLength(2);
    const activePay = payButtons.find(b => !b.disabled);
    fireEvent.click(activePay);
    expect(screen.getByText('Pay Krishna Distributors')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '200' } });
    fireEvent.change(screen.getByPlaceholderText('Reference Number (Optional)'), { target: { value: 'UTR123' } });

    fireEvent.click(screen.getByText('Record Payment'));

    await waitFor(() => {
      expect(createSupplierPayment).toHaveBeenCalledWith({
        supplierId: 's1',
        amount: '200',
        paymentMethod: 'cash',
        referenceNumber: 'UTR123',
        notes: undefined
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Payment recorded');
  });
});