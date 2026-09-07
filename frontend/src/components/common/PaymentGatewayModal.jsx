import { useState } from 'react';
import { verifyPayment } from '../../services/api';
import toast from 'react-hot-toast';
import { FiCheck } from 'react-icons/fi';

const MODE_LABELS = {
  upi: 'UPI',
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
  net_banking: 'Net Banking'
};

export default function PaymentGatewayModal({ open, onClose, orderNumber, amount, paymentMode, gatewayData, onSuccess }) {
  const [cardForm, setCardForm] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [upiId, setUpiId] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  if (!open) return null;

  const handleAuthorize = async () => {
    if (!gatewayData) return;
    setPaymentProcessing(true);
    try {
      await new Promise(r => setTimeout(r, 1500));
      await verifyPayment({
        gatewayOrderId: gatewayData.gatewayOrderId,
        gatewayPaymentId: 'pay_' + Math.random().toString(36).substring(2, 14),
        gatewaySignature: 'sig_' + Math.random().toString(36).substring(2, 18)
      });
      toast.success('💳 Payment successful! Order confirmed.');
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment verification failed');
    } finally {
      setPaymentProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-100">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">G</div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Ganesh Trades Gateway</h3>
              <p className="text-[10px] text-gray-400">Order #{orderNumber}</p>
            </div>
          </div>
          <span className="text-lg font-bold text-primary-600">₹{amount?.toFixed(2)}</span>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs flex justify-between">
            <span className="text-gray-500">Selected Mode:</span>
            <span className="font-bold capitalize text-primary-700">{MODE_LABELS[paymentMode] || paymentMode?.replace('_', ' ')}</span>
          </div>

          {paymentMode === 'upi' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Enter VPA / UPI ID</label>
              <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="username@upi or mobile@paytm"
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          )}

          {(paymentMode === 'debit_card' || paymentMode === 'credit_card') && (
            <div className="space-y-2">
              <input type="text" placeholder="Card Number (16 digits)" value={cardForm.number} onChange={e => setCardForm({...cardForm, number: e.target.value})}
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" maxLength={16} />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="MM/YY" value={cardForm.expiry} onChange={e => setCardForm({...cardForm, expiry: e.target.value})}
                  className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" maxLength={5} />
                <input type="password" placeholder="CVV" value={cardForm.cvv} onChange={e => setCardForm({...cardForm, cvv: e.target.value})}
                  className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" maxLength={4} />
              </div>
            </div>
          )}

          {paymentMode === 'net_banking' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Bank</label>
              <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="">Choose Bank</option>
                <option value="sbi">State Bank of India</option>
                <option value="hdfc">HDFC Bank</option>
                <option value="icici">ICICI Bank</option>
                <option value="axis">Axis Bank</option>
              </select>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <button onClick={handleAuthorize} disabled={paymentProcessing}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2">
            {paymentProcessing ? (
              <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></span> Processing Payment...</span>
            ) : (
              <><FiCheck /> Authorize Payment of ₹{amount?.toFixed(2)}</>
            )}
          </button>
          <button onClick={onClose} disabled={paymentProcessing}
            className="w-full py-2 text-gray-400 hover:text-gray-600 text-xs text-center">
            Cancel Transaction
          </button>
        </div>
      </div>
    </div>
  );
}