// MIT License
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, ShieldCheck, Database, RefreshCw, Wifi, WifiOff, AlertCircle, CheckCircle2, LayoutDashboard, UserPlus, History, Search, Filter, Trash2, X, ExternalLink, ArrowRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { blockchainService } from './services/blockchain';
import { saveFarmerOffline, getPendingFarmers, updateFarmerStatus, getAllFarmers, clearDatabase, deleteFarmer } from './services/db';
import { FarmerRecord, SubsidyStats } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode, className?: string, title?: string, icon?: any }) => (
  <div className={cn("bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm", className)}>
    {title && (
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-4 h-4 text-zinc-500" />}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">{title}</h3>
      </div>
    )}
    {children}
  </div>
);

const Stat = ({ label, value, subValue, trend }: { label: string, value: string, subValue?: string, trend?: 'up' | 'down' }) => (
  <div className="flex flex-col">
    <span className="text-xs font-medium text-zinc-500 mb-1">{label}</span>
    <span className="text-3xl font-light tracking-tight text-zinc-900">{value}</span>
    {subValue && <span className="text-xs text-zinc-400 mt-1">{subValue}</span>}
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'register' | 'history' | 'admin' | 'dealer'>('dashboard');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stats, setStats] = useState<SubsidyStats>({ totalDelivered: '0 NGN', leakagePrevented: '0 NGN', activeFarmers: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [farmers, setFarmers] = useState<FarmerRecord[]>([]);
  const [filteredFarmers, setFilteredFarmers] = useState<FarmerRecord[]>([]);

  // Registration Form State
  const [nationalId, setNationalId] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [cropType, setCropType] = useState('Maize');
  const [farmSize, setFarmSize] = useState('');
  const [regStatus, setRegStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Admin/Dealer Form State
  const [adminTargetAddress, setAdminTargetAddress] = useState('');
  const [disburseAmount, setDisburseAmount] = useState('');
  const [dealerFarmerAddress, setDealerFarmerAddress] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimProof, setClaimProof] = useState('');
  const [actionStatus, setActionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // History Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'synced' | 'error'>('all');
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerRecord | null>(null);

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    
    loadData();
    
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    let result = farmers;
    if (statusFilter !== 'all') {
      result = result.filter(f => f.status === statusFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f => 
        f.walletAddress.toLowerCase().includes(query) || 
        f.hashedId.toLowerCase().includes(query)
      );
    }
    setFilteredFarmers(result);
  }, [farmers, searchQuery, statusFilter]);

  const loadData = async () => {
    const blockchainStats = await blockchainService.getStats();
    const allFarmers = await getAllFarmers();
    const pending = await getPendingFarmers();
    
    setFarmers(allFarmers);
    setPendingCount(pending.length);
    setStats({
      ...blockchainStats,
      activeFarmers: allFarmers.length
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegStatus('loading');

    try {
      const hashedId = (blockchainService.constructor as any).hashId(nationalId);
      const record: Omit<FarmerRecord, 'id'> = {
        hashedId,
        walletAddress,
        cropType,
        farmSize,
        status: 'pending',
        timestamp: Date.now()
      };

      await saveFarmerOffline(record);
      setNationalId('');
      setWalletAddress('');
      setCropType('Maize');
      setFarmSize('');
      setRegStatus('success');
      loadData();
      
      setTimeout(() => setRegStatus('idle'), 3000);
    } catch (err) {
      setRegStatus('error');
    }
  };

  const handleSync = async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    
    try {
      const pending = farmers.filter(f => f.status === 'pending' || f.status === 'error');
      const connected = await blockchainService.connect();
      
      if (!connected) {
        alert("Please connect your wallet (MetaMask) to sync with Polygon.");
        setIsSyncing(false);
        return;
      }

      for (const farmer of pending) {
        try {
          await blockchainService.registerFarmer(farmer.walletAddress, farmer.hashedId);
          await updateFarmerStatus(farmer.id!, 'synced');
        } catch (e) {
          console.error("Sync failed for", farmer.walletAddress, e);
          await updateFarmerStatus(farmer.id!, 'error');
        }
      }
      
      await loadData();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetrySync = async (farmer: FarmerRecord) => {
    if (!isOnline) {
      alert("Internet connection required to sync.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const connected = await blockchainService.connect();
      if (!connected) {
        alert("Please connect your wallet.");
        return;
      }
      
      await blockchainService.registerFarmer(farmer.walletAddress, farmer.hashedId);
      await updateFarmerStatus(farmer.id!, 'synced');
      await loadData();
    } catch (e) {
      console.error("Retry failed", e);
      alert("Retry failed. Check blockchain connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearData = async () => {
    if (confirm("Are you sure you want to clear all local data? This cannot be undone.")) {
      await clearDatabase();
      await loadData();
    }
  };

  const handleDeleteFarmer = async (id: number) => {
    if (confirm("Delete this record?")) {
      await deleteFarmer(id);
      await loadData();
    }
  };

  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) return alert("Online connection required for blockchain transactions.");
    setActionStatus('loading');
    try {
      await blockchainService.connect();
      await blockchainService.disburseSubsidy(adminTargetAddress, disburseAmount);
      setTimeout(() => {
        setActionStatus('success');
        setAdminTargetAddress('');
        setDisburseAmount('');
        loadData();
        setTimeout(() => setActionStatus('idle'), 3000);
      }, 1500);
    } catch (err) {
      setActionStatus('error');
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) return alert("Online connection required for blockchain transactions.");
    setActionStatus('loading');
    try {
      await blockchainService.connect();
      await blockchainService.claimReimbursement(dealerFarmerAddress, claimAmount, claimProof);
      setTimeout(() => {
        setActionStatus('success');
        setDealerFarmerAddress('');
        setClaimAmount('');
        setClaimProof('');
        loadData();
        setTimeout(() => setActionStatus('idle'), 3000);
      }, 1500);
    } catch (err) {
      setActionStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-zinc-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">AgriSmart Connect</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
              isOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
            )}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? "Online" : "Offline Mode"}
            </div>
            
            <button 
              onClick={handleSync}
              disabled={isSyncing || !isOnline || pendingCount === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                isSyncing ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-95 disabled:opacity-50"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
              {isSyncing ? "Syncing..." : `Sync (${pendingCount})`}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation */}
        <nav className="flex gap-1 mb-8 bg-zinc-200/50 p-1 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'dashboard' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('register')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'register' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <UserPlus className="w-4 h-4" />
            Registration
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'history' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <History className="w-4 h-4" />
            Ledger
          </button>
          <button 
            onClick={() => setActiveTab('admin')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'admin' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin
          </button>
          <button 
            onClick={() => setActiveTab('dealer')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === 'dealer' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <Users className="w-4 h-4" />
            Dealer
          </button>
        </nav>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card title="Transparency Ledger" icon={Database} className="md:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 py-4">
                <Stat 
                  label="Total Subsidies Delivered" 
                  value={stats.totalDelivered} 
                  subValue="Verified on Polygon PoS"
                />
                <Stat 
                  label="Leakage Prevented" 
                  value={stats.leakagePrevented} 
                  subValue="Blocked unauthorized claims"
                />
              </div>
              <div className="mt-8 pt-8 border-t border-zinc-100">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Live Blockchain Feed
                  </div>
                  <span>Last updated: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </Card>

            <Card title="Network Status" icon={Users}>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Active Farmers</span>
                  <span className="text-lg font-semibold">{stats.activeFarmers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Pending Sync</span>
                  <span className="text-lg font-semibold text-amber-600">{pendingCount}</span>
                </div>
                <div className="pt-4 border-t border-zinc-100">
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    DPG Standard Indicator 7: Data Minimization active. 
                    No PII is stored on-chain. All identifiers are Keccak-256 hashed.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="max-w-2xl mx-auto">
            <Card title="Farmer Enrollment" icon={UserPlus}>
              <form onSubmit={handleRegister} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">National ID (Hashed Locally)</label>
                  <input 
                    type="text" 
                    required
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="e.g. NIN-123456789"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Polygon Wallet Address</label>
                  <input 
                    type="text" 
                    required
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Crop Type</label>
                    <select 
                      value={cropType}
                      onChange={(e) => setCropType(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                    >
                      <option value="Maize">Maize</option>
                      <option value="Rice">Rice</option>
                      <option value="Cassava">Cassava</option>
                      <option value="Yam">Yam</option>
                      <option value="Cocoa">Cocoa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Farm Size (Hectares)</label>
                    <input 
                      type="number" 
                      required
                      step="0.1"
                      value={farmSize}
                      onChange={(e) => setFarmSize(e.target.value)}
                      placeholder="e.g. 2.5"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  disabled={regStatus === 'loading'}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  {regStatus === 'loading' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {regStatus === 'loading' ? 'Processing...' : 'Register Farmer'}
                </button>

                {regStatus === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700 text-sm"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {isOnline 
                      ? "Farmer registered successfully." 
                      : "Farmer registered successfully. Record is saved locally and will sync when online."}
                  </motion.div>
                )}

                {!isOnline && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3 text-amber-700 text-sm">
                    <AlertCircle className="w-5 h-5" />
                    You are offline. Data will be stored locally and synced later.
                  </div>
                )}
              </form>
            </Card>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="max-w-2xl mx-auto">
            <Card title="Subsidy Disbursement" icon={ShieldCheck}>
              <form onSubmit={handleDisburse} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Farmer Wallet Address</label>
                  <input 
                    type="text" 
                    required
                    value={adminTargetAddress}
                    onChange={(e) => setAdminTargetAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Amount (NGN)</label>
                  <input 
                    type="number" 
                    required
                    value={disburseAmount}
                    onChange={(e) => setDisburseAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={actionStatus === 'loading' || !isOnline}
                  className="w-full bg-zinc-900 text-white py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Disburse Subsidy
                </button>
                {actionStatus === 'success' && (
                  <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Subsidy disbursed successfully on-chain.
                  </div>
                )}
              </form>
            </Card>
          </div>
        )}

        {activeTab === 'dealer' && (
          <div className="max-w-2xl mx-auto">
            <Card title="Reimbursement Claim" icon={Users}>
              <form onSubmit={handleClaim} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Farmer Wallet Address</label>
                  <input 
                    type="text" 
                    required
                    value={dealerFarmerAddress}
                    onChange={(e) => setDealerFarmerAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Claim Amount (NGN)</label>
                  <input 
                    type="number" 
                    required
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2">Proof of Delivery (Signed Hash)</label>
                  <input 
                    type="text" 
                    required
                    value={claimProof}
                    onChange={(e) => setClaimProof(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={actionStatus === 'loading' || !isOnline}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionStatus === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Claim Reimbursement
                </button>
                {actionStatus === 'success' && (
                  <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Reimbursement claim submitted successfully.
                  </div>
                )}
              </form>
            </Card>
          </div>
        )}

        {activeTab === 'history' && (
          <Card title="Local Registration Ledger" icon={History}>
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Search by wallet or hashed ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-zinc-400" />
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="synced">Synced</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <button 
                onClick={handleClearData}
                className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear Data
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="py-4 text-xs font-semibold text-zinc-500 uppercase">Hashed ID</th>
                    <th className="py-4 text-xs font-semibold text-zinc-500 uppercase">Wallet</th>
                    <th className="py-4 text-xs font-semibold text-zinc-500 uppercase">Status</th>
                    <th className="py-4 text-xs font-semibold text-zinc-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredFarmers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-zinc-400 text-sm italic">No records found</td>
                    </tr>
                  ) : (
                    filteredFarmers.map((farmer) => (
                      <tr key={farmer.id} className="hover:bg-zinc-50 transition-colors group">
                        <td className="py-4 text-xs font-mono text-zinc-600 truncate max-w-[120px]">{farmer.hashedId}</td>
                        <td className="py-4 text-xs font-mono text-zinc-600 truncate max-w-[120px]">{farmer.walletAddress}</td>
                        <td className="py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            farmer.status === 'synced' ? "bg-emerald-100 text-emerald-700" : 
                            farmer.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {farmer.status}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setSelectedFarmer(farmer)}
                              className="p-2 rounded-lg hover:bg-zinc-200 text-zinc-500 transition-colors"
                              title="View Details"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {(farmer.status === 'error' || farmer.status === 'pending') && (
                              <button 
                                onClick={() => handleRetrySync(farmer)}
                                disabled={isSyncing || !isOnline}
                                className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors disabled:opacity-50"
                                title="Retry Sync"
                              >
                                <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteFarmer(farmer.id!)}
                              className="p-2 rounded-lg hover:bg-rose-100 text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* Detail Modal */}
      {selectedFarmer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setSelectedFarmer(null)}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Farmer Details</h2>
                    <p className="text-xs text-zinc-500">Registered on {new Date(selectedFarmer.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedFarmer(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">Hashed Identifier (Keccak-256)</label>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 font-mono text-xs break-all text-zinc-600">
                    {selectedFarmer.hashedId}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">Polygon Wallet Address</label>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 font-mono text-xs break-all text-zinc-600 flex items-center justify-between">
                    {selectedFarmer.walletAddress}
                    <ArrowRight className="w-3 h-3 text-zinc-300" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">Crop Type</label>
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-sm text-zinc-600">
                      {selectedFarmer.cropType}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">Farm Size</label>
                    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-sm text-zinc-600">
                      {selectedFarmer.farmSize} Ha
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                  <span className="text-sm font-medium text-zinc-600">Sync Status</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                    selectedFarmer.status === 'synced' ? "bg-emerald-100 text-emerald-700" : 
                    selectedFarmer.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                  )}>
                    {selectedFarmer.status}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                {selectedFarmer.status !== 'synced' && (
                  <button 
                    onClick={() => {
                      handleRetrySync(selectedFarmer);
                      setSelectedFarmer(null);
                    }}
                    disabled={!isOnline}
                    className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-medium hover:bg-zinc-800 transition-all disabled:opacity-50"
                  >
                    Sync to Blockchain
                  </button>
                )}
                <button 
                  onClick={() => setSelectedFarmer(null)}
                  className="flex-1 bg-zinc-100 text-zinc-600 py-3 rounded-xl font-medium hover:bg-zinc-200 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
            
            <div className="bg-zinc-50 px-8 py-4 border-t border-zinc-100">
              <p className="text-[10px] text-zinc-400 text-center">
                This record is protected by DPG Data Minimization standards. 
                No personal data is stored in the local database or on the blockchain.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-zinc-400">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-medium">AgriSmart Connect Prototype v1.0</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">MIT License</a>
            <a href="#" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">DPG Standard</a>
            <a href="#" className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors">UNICEF Venture Fund</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
