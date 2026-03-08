// MIT License
export interface FarmerRecord {
  id?: number;
  hashedId: string;
  walletAddress: string;
  cropType: string;
  farmSize: string;
  status: 'pending' | 'synced' | 'error';
  timestamp: number;
}

export interface SubsidyStats {
  totalDelivered: string;
  leakagePrevented: string;
  activeFarmers: number;
}

export interface BlockchainTransaction {
  farmerAddress: string;
  amount: string;
  proof: string;
}
