import { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertCircle, Server, Key } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [dbInfo, setDbInfo] = useState({
    url: import.meta.env.VITE_SUPABASE_URL || '',
    tablesCount: 0,
    lastChecked: new Date()
  });

  useEffect(() => {
    checkDatabaseConnection();
  }, []);

  const checkDatabaseConnection = async () => {
    setDbStatus('checking');
    try {
      const { data, error } = await supabase
        .from('scan_results')
        .select('id', { count: 'exact', head: true });

      if (error) throw error;

      const tables = ['scan_results', 'vulnerabilities', 'assets', 'monitoring_checks',
                     'compliance_audits', 'training_modules', 'incidents'];

      setDbInfo({
        url: import.meta.env.VITE_SUPABASE_URL || '',
        tablesCount: tables.length,
        lastChecked: new Date()
      });
      setDbStatus('connected');
    } catch (err) {
      console.error('Database connection error:', err);
      setDbStatus('error');
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Database Configuration
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Supabase database connection and status
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    dbStatus === 'connected'
                      ? 'bg-green-500'
                      : dbStatus === 'checking'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500'
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Connection Status
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {dbStatus === 'connected'
                      ? 'Connected'
                      : dbStatus === 'checking'
                      ? 'Checking...'
                      : 'Connection Error'}
                  </p>
                </div>
              </div>
              {dbStatus === 'connected' && (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              )}
              {dbStatus === 'error' && (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Database URL
                  </p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all">
                  {dbInfo.url}
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Active Tables
                  </p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {dbInfo.tablesCount} tables configured
                </p>
              </div>
            </div>

            <button
              onClick={checkDatabaseConnection}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Test Connection
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <Key className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                User Profile
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your account information
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                Email Address
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {user?.email || 'Not available'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                User ID
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all">
                {user?.id || 'Not available'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                Account Created
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Not available'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Database Tables
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Scanner Agent</h4>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                <li>• scan_results</li>
                <li>• vulnerabilities</li>
                <li>• assets</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Monitoring Agent</h4>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                <li>• monitoring_checks</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Compliance Agent</h4>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                <li>• compliance_audits</li>
                <li>• framework_requirements</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Training Agent</h4>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                <li>• training_modules</li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Incidents Agent</h4>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                <li>• incidents</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
