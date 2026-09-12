import { useState, useEffect, useRef, useCallback } from 'react';
import { askAiAssistant, getAiSnapshot } from '../../services/api';
import {
  FiCpu,
  FiX,
  FiSend,
  FiRefreshCw,
  FiAlertTriangle,
  FiDollarSign,
  FiTruck,
  FiPackage,
  FiHelpCircle
} from 'react-icons/fi';

const QUICK_PROMPTS = [
  "What are today's orders?",
  "Which products are low in stock?",
  "What are the top-selling products?",
  "Which payments are pending?",
  "What deliveries are scheduled today?",
  "Give me a sales summary for the last 30 days."
];

export default function AiBusinessAssistant({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Hello! I am your **Ganesh AI Business Assistant**.\n\nI have direct access to your real-time store metrics, inventory levels, today's order dispatches, and outstanding customer Khata credit. Ask me anything or select one of the executive queries below!`,
      timestamp: new Date()
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const chatBottomRef = useRef(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      setSnapshotLoading(true);
      const res = await getAiSnapshot();
      if (res.data?.success) {
        setSnapshot(res.data.data);
      }
    } catch (err) {
      console.warn('Could not load snapshot preview:', err);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Load fresh snapshot whenever opened
  useEffect(() => {
    if (isOpen) {
      fetchSnapshot();
    }
  }, [isOpen, fetchSnapshot]);

  const handleSend = async (queryText) => {
    const text = (queryText || inputQuery).trim();
    if (!text || loading) return;

    const userMsg = {
      id: 'user-' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await askAiAssistant(text);
      const assistantMsg = {
        id: 'ai-' + Date.now(),
        role: 'assistant',
        text: res.data.answer || 'I could not generate an answer at this time.',
        aiPowered: res.data.aiPowered,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (res.data.snapshot) {
        setSnapshot(res.data.snapshot);
      }
    } catch (err) {
      const errorMsg = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        text: `⚠️ **Unable to fetch live analysis.** ${err.response?.data?.message || err.message || 'Please verify network connection.'}`,
        isError: true,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-navy-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl h-[90vh] max-h-[780px] bg-navy-900 border border-navy-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 border-b border-navy-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mint-400 to-emerald-600 flex items-center justify-center text-navy-950 shadow-lg shadow-mint-500/20">
              <FiCpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base sm:text-lg">Ganesh AI Business Assistant</h3>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-mint-500/20 text-mint-300 rounded-full border border-mint-500/30">
                  Live MongoDB Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-400">Executive analytics, inventory alerts & order insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSnapshot}
              title="Refresh live metrics"
              disabled={snapshotLoading}
              className="p-2 text-slate-400 hover:text-mint-400 hover:bg-navy-800 rounded-lg transition-colors"
            >
              <FiRefreshCw className={`w-4 h-4 ${snapshotLoading ? 'animate-spin text-mint-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-navy-800 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Snapshot Strip */}
        {snapshot && (
          <div className="bg-navy-950/70 border-b border-navy-800 px-5 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <FiPackage className="text-mint-400 w-3.5 h-3.5 flex-shrink-0" />
              <span>Today: <strong className="text-white">{snapshot.today?.orderCount || 0}</strong> orders (₹{(snapshot.today?.revenue || 0).toLocaleString('en-IN')})</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <FiAlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${snapshot.inventory?.lowStockCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>Low Stock: <strong className={snapshot.inventory?.lowStockCount > 0 ? 'text-amber-400' : 'text-white'}>{snapshot.inventory?.lowStockCount || 0}</strong> items</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <FiDollarSign className="text-emerald-400 w-3.5 h-3.5 flex-shrink-0" />
              <span>Khata Due: <strong className="text-white">₹{(snapshot.finance?.totalCreditOutstanding || 0).toLocaleString('en-IN')}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <FiTruck className="text-sky-400 w-3.5 h-3.5 flex-shrink-0" />
              <span>Dispatches: <strong className="text-white">{snapshot.deliveries?.totalToday || 0}</strong> today</span>
            </div>
          </div>
        )}

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-mint-500 text-navy-950 font-medium rounded-tr-none shadow-md shadow-mint-500/10'
                    : msg.isError
                    ? 'bg-rose-950/40 border border-rose-800 text-rose-200 rounded-tl-none'
                    : 'bg-navy-800/90 border border-navy-700/80 text-slate-100 rounded-tl-none shadow-sm'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-navy-700/60 text-xs text-slate-400">
                    <span className="font-semibold text-mint-400 flex items-center gap-1.5">
                      <FiCpu className="w-3.5 h-3.5" />
                      Ganesh Assistant
                    </span>
                    {msg.aiPowered && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                        Gemini 2.5 Flash
                      </span>
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap space-y-1">
                  {msg.text.split('\n').map((line, idx) => {
                    // Simple markdown bullet and bold rendering
                    if (line.startsWith('• ') || line.startsWith('*   ') || line.startsWith('- ')) {
                      return (
                        <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
                          <span className="text-mint-400 mt-1 text-xs">•</span>
                          <span>{renderFormattedText(line.replace(/^[•*\s-]+/, ''))}</span>
                        </div>
                      );
                    }
                    return <p key={idx}>{renderFormattedText(line)}</p>;
                  })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-navy-800/90 border border-navy-700/80 rounded-2xl rounded-tl-none p-4 flex items-center gap-3 text-sm text-slate-300">
                <div className="w-5 h-5 border-2 border-mint-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing store data across orders, inventory & accounts...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Prompts Carousel */}
        <div className="px-4 py-2.5 bg-navy-950/50 border-t border-navy-800/80 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <FiHelpCircle className="w-3.5 h-3.5" /> Suggested:
            </span>
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(qp)}
                disabled={loading}
                className="px-2.5 py-1 text-xs bg-navy-850 hover:bg-navy-800 text-slate-300 hover:text-mint-400 border border-navy-700 rounded-lg transition-all disabled:opacity-50"
              >
                {qp}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 sm:p-4 bg-navy-900 border-t border-navy-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask anything (e.g., Which products are low in stock?)..."
            disabled={loading}
            className="flex-1 bg-navy-950 border border-navy-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-mint-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="px-4 py-2.5 bg-mint-500 hover:bg-mint-400 text-navy-950 font-bold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-mint-500/20"
          >
            <FiSend className="w-4 h-4" />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Lightweight helper to highlight **bold** strings safely
 */
function renderFormattedText(text) {
  if (!text) return '';
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
