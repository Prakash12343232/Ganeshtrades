import { Link } from 'react-router-dom';
import { FiHome, FiPackage } from 'react-icons/fi';
import logoImg from '../assets/logo.png';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-mint-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-navy-800/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-fadeIn relative z-10 my-8">
        <div className="bg-navy-900/90 backdrop-blur-xl rounded-3xl p-10 border border-navy-700/80 shadow-2xl text-center">
          <div className="w-20 h-20 bg-navy-950/90 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-6 border border-mint-500/30 shadow-xl shadow-mint-500/5 overflow-hidden">
            <img src={logoImg} alt="Ganesh Trades Logo" className="w-14 h-14 object-contain drop-shadow-[0_4px_10px_rgba(52,211,153,0.3)]" />
          </div>
          <h1 className="text-6xl font-extrabold text-mint-400 tracking-tight leading-none">404</h1>
          <h2 className="text-xl font-bold text-white mt-3">Page Not Found</h2>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            The page you are looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back to the shop.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link
              to="/"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-mint-500 hover:bg-mint-400 text-navy-950 rounded-xl font-extrabold text-sm transition-all shadow-lg shadow-mint-500/20 active:scale-95"
            >
              <FiHome className="w-4 h-4" /> Back to Home
            </Link>
            <Link
              to="/products"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-navy-950 border border-navy-700 hover:border-mint-500/40 text-slate-200 rounded-xl font-semibold text-sm transition-all"
            >
              <FiPackage className="w-4 h-4" /> Browse Products
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}