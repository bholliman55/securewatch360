import { X, Server, Shield, AlertTriangle, Clock, Tag, User, Globe, Monitor, HardDrive, Wifi } from 'lucide-react';
import { Asset } from '../services/scannerService';
import { formatDistanceToNow } from '../utils/formatters';

interface AssetDetailModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
}

const ASSET_TYPE_ICONS: Record<string, React.ReactNode> = {
  server: <Server className="w-5 h-5" />,
  workstation: <Monitor className="w-5 h-5" />,
  network_device: <Wifi className="w-5 h-5" />,
  storage: <HardDrive className="w-5 h-5" />,
  web_application: <Globe className="w-5 h-5" />,
};

function getCriticalityColor(criticality: string) {
  switch ((criticality || '').toLowerCase()) {
    case 'critical': return 'text-red-400 bg-red-900/20 border-red-700';
    case 'high': return 'text-orange-400 bg-orange-900/20 border-orange-700';
    case 'medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-700';
    case 'low': return 'text-blue-400 bg-blue-900/20 border-blue-700';
    default: return 'text-slate-400 bg-slate-900/20 border-slate-600';
  }
}

function getCriticalityDot(criticality: string) {
  switch ((criticality || '').toLowerCase()) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-blue-500';
    default: return 'bg-slate-500';
  }
}

export default function AssetDetailModal({ asset, isOpen, onClose }: AssetDetailModalProps) {
  if (!isOpen || !asset) return null;

  const typeIcon = ASSET_TYPE_ICONS[asset.asset_type?.toLowerCase()] ?? <Server className="w-5 h-5" />;
  const critClass = getCriticalityColor(asset.criticality);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              {typeIcon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 leading-tight">
                {asset.asset_name}
              </h2>
              <p className="text-sm text-slate-400 capitalize mt-0.5">
                {asset.asset_type ? asset.asset_type.replace(/_/g, ' ') : 'Unknown type'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl border px-4 py-3 ${critClass}`}>
              <div className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">Criticality</div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${getCriticalityDot(asset.criticality)}`} />
                <span className="font-semibold capitalize">{asset.criticality || 'Unknown'}</span>
              </div>
            </div>

            <div className={`rounded-xl border px-4 py-3 ${asset.vulnerability_count > 0 ? 'text-red-400 bg-red-900/20 border-red-700' : 'text-green-400 bg-green-900/20 border-green-700'}`}>
              <div className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">Vulnerabilities</div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-semibold">{asset.vulnerability_count}</span>
                <span className="text-xs opacity-70">{asset.vulnerability_count === 1 ? 'found' : 'found'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl divide-y divide-slate-700">
            {asset.asset_identifier && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Identifier</div>
                  <div className="text-sm font-mono text-slate-200">{asset.asset_identifier}</div>
                </div>
              </div>
            )}

            {asset.operating_system && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Monitor className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Operating System</div>
                  <div className="text-sm text-slate-200">{asset.operating_system}</div>
                </div>
              </div>
            )}

            {asset.environment && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Environment</div>
                  <div className="text-sm text-slate-200 capitalize">{asset.environment}</div>
                </div>
              </div>
            )}

            {asset.owner && (
              <div className="flex items-center gap-3 px-4 py-3">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Owner</div>
                  <div className="text-sm text-slate-200">{asset.owner}</div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 px-4 py-3">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Last Scan</div>
                <div className="text-sm text-slate-200">
                  {asset.last_scan_date ? formatDistanceToNow(asset.last_scan_date) : 'Never scanned'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3">
              <Shield className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Asset ID</div>
                <div className="text-sm font-mono text-slate-200">#{asset.asset_id}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-xl font-medium text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
