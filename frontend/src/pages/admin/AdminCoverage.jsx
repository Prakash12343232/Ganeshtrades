import { useState, useEffect } from 'react';
import { getSettings, updateSettings, getCoverageStats } from '../../services/api';
import toast from 'react-hot-toast';
import { FiMap, FiSave, FiUsers, FiNavigation, FiTarget, FiActivity, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom shop icon
const shopIcon = new L.DivIcon({
  className: 'custom-shop-icon',
  html: '<div style="background:#7e22ce;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-size:16px;">🏪</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Customer marker icons
const customerInIcon = new L.DivIcon({
  className: 'custom-customer-icon',
  html: '<div style="background:#22c55e;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const customerOutIcon = new L.DivIcon({
  className: 'custom-customer-icon',
  html: '<div style="background:#ef4444;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function AdminCoverage() {
  const [settings, setSettings] = useState({
    shopName: 'Ganesh Trades',
    shopAddress: 'HW4C+XJ Pune, Maharashtra, India',
    shopPlusCode: 'HW4C+XJ',
    shopLocation: { lat: 18.5574375, lng: 73.9215625 },
    deliveryRadiusKm: 15,
    isDeliveryRestrictionActive: true,
    deliveryFeePerKm: 0,
    freeDeliveryWithinKm: 5
  });
  const [coverageStats, setCoverageStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCustomers, setShowCustomers] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [settingsRes, statsRes] = await Promise.all([
        getSettings(),
        getCoverageStats().catch(() => null)
      ]);
      setSettings(settingsRes.data.data);
      if (statsRes) setCoverageStats(statsRes.data.data);
    } catch {
      toast.error('Failed to load coverage data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(settings);
      toast.success('Coverage settings updated successfully');
      // Reload stats
      const statsRes = await getCoverageStats().catch(() => null);
      if (statsRes) setCoverageStats(statsRes.data.data);
    } catch {
      toast.error('Failed to update coverage settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  const center = [settings.shopLocation.lat, settings.shopLocation.lng];
  const stats = coverageStats?.stats;
  const buckets = coverageStats?.distanceBuckets || [];
  const customers = coverageStats?.customerMarkers || [];

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FiMap className="text-primary-600" /> Delivery Coverage Map
        </h1>
        <p className="text-sm text-gray-500 mt-1">Configure your serviceable delivery radius and view coverage analytics.</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <FiUsers className="text-primary-600 w-4 h-4" />
              </div>
              <span className="text-xs text-gray-500">Total Customers</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stats.totalCustomers}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <FiTarget className="text-green-600 w-4 h-4" />
              </div>
              <span className="text-xs text-gray-500">Within Radius</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.withinRadius}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <FiNavigation className="text-red-600 w-4 h-4" />
              </div>
              <span className="text-xs text-gray-500">Outside Radius</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.outsideRadius}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <FiActivity className="text-amber-600 w-4 h-4" />
              </div>
              <span className="text-xs text-gray-500">Avg Distance</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.avgDistance} KM</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Coverage Settings</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Radius (KM)</label>
                <input 
                  type="number" 
                  value={settings.deliveryRadiusKm} 
                  onChange={e => setSettings({ ...settings, deliveryRadiusKm: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="1"
                  max="100"
                  step="0.1"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Current: {settings.deliveryRadiusKm} KM from shop</p>
              </div>

              {/* Delivery Restriction Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Delivery Restriction</p>
                  <p className="text-xs text-gray-400">{settings.isDeliveryRestrictionActive ? 'Active — blocking out-of-range orders' : 'Disabled — all orders allowed'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, isDeliveryRestrictionActive: !settings.isDeliveryRestrictionActive })}
                  className={`text-2xl ${settings.isDeliveryRestrictionActive ? 'text-green-500' : 'text-gray-400'}`}
                >
                  {settings.isDeliveryRestrictionActive ? <FiToggleRight /> : <FiToggleLeft />}
                </button>
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Shop Location</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Shop Name</label>
                    <input 
                      type="text" 
                      value={settings.shopName || ''} 
                      onChange={e => setSettings({ ...settings, shopName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Plus Code</label>
                    <input 
                      type="text" 
                      value={settings.shopPlusCode || ''} 
                      onChange={e => setSettings({ ...settings, shopPlusCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="e.g. HW4C+XJ"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                    <input 
                      type="number" 
                      value={settings.shopLocation.lat} 
                      onChange={e => setSettings({ ...settings, shopLocation: { ...settings.shopLocation, lat: parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      step="0.000001"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                    <input 
                      type="number" 
                      value={settings.shopLocation.lng} 
                      onChange={e => setSettings({ ...settings, shopLocation: { ...settings.shopLocation, lng: parseFloat(e.target.value) } })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      step="0.000001"
                      required
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={saving}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <FiSave /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>

          {/* Distance Distribution */}
          {buckets.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-sm font-bold text-gray-800 mb-3">Customer Distribution</h2>
              <div className="space-y-2">
                {buckets.map((bucket, i) => {
                  const maxCount = Math.max(...buckets.map(b => b.count), 1);
                  const widthPct = (bucket.count / maxCount) * 100;
                  const colors = ['bg-green-500', 'bg-emerald-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500'];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16 flex-shrink-0">{bucket.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                          className={`h-full ${colors[i]} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                          style={{ width: `${Math.max(widthPct, bucket.count > 0 ? 15 : 0)}%` }}
                        >
                          {bucket.count > 0 && <span className="text-[10px] text-white font-bold">{bucket.count}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Live Map */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map Controls */}
          <div className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-purple-600 rounded-full inline-block"></span>
                Shop ({settings.shopPlusCode || 'HW4C+XJ'})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-green-500 rounded-full inline-block"></span>
                Within Radius
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-red-500 rounded-full inline-block"></span>
                Outside Radius
              </span>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showCustomers} onChange={e => setShowCustomers(e.target.checked)} className="rounded" />
              Show Customers
            </label>
          </div>

          <div className="bg-white rounded-2xl p-2 border border-gray-100 shadow-sm overflow-hidden" style={{ height: '600px' }}>
            <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%', borderRadius: '12px' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Delivery Radius Circle */}
              <Circle 
                center={center} 
                radius={settings.deliveryRadiusKm * 1000}
                pathOptions={{ fillColor: '#8b5cf6', color: '#6d28d9', weight: 2, fillOpacity: 0.12, dashArray: '8 4' }}
              />
              
              {/* Inner zone (free delivery) */}
              <Circle 
                center={center} 
                radius={(settings.freeDeliveryWithinKm || 5) * 1000}
                pathOptions={{ fillColor: '#22c55e', color: '#16a34a', weight: 1, fillOpacity: 0.08, dashArray: '4 4' }}
              />

              {/* Shop Marker */}
              <Marker position={center} icon={shopIcon}>
                <Popup>
                  <div style={{ minWidth: '160px' }}>
                    <strong style={{ fontSize: '14px' }}>🏪 {settings.shopName || 'Ganesh Trades'}</strong><br />
                    <span style={{ fontSize: '11px', color: '#666' }}>
                      Plus Code: {settings.shopPlusCode || 'HW4C+XJ'}<br />
                      {settings.shopAddress || 'Pune, Maharashtra'}<br />
                      <strong>Radius: {settings.deliveryRadiusKm} KM</strong>
                    </span>
                  </div>
                </Popup>
              </Marker>

              {/* Customer Markers */}
              {showCustomers && customers.map(c => (
                <Marker 
                  key={c.id} 
                  position={[c.lat, c.lng]} 
                  icon={c.withinRadius ? customerInIcon : customerOutIcon}
                >
                  <Popup>
                    <div style={{ minWidth: '140px' }}>
                      <strong style={{ fontSize: '12px' }}>{c.name}</strong><br />
                      <span style={{ fontSize: '11px', color: '#666' }}>
                        📱 {c.mobile}<br />
                        📏 {c.distance} KM from shop<br />
                        <span style={{ color: c.withinRadius ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                          {c.withinRadius ? '✓ Serviceable' : '✗ Out of range'}
                        </span>
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}

              <MapUpdater center={center} />
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
