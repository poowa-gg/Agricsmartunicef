// MIT License
import { ethers } from 'ethers';

// Mock ABI based on AgriTrace.sol
export const AGRI_TRACE_ABI = [
  "function registerFarmer(address _farmer, bytes32 _hashedId) external",
  "function disburseSubsidy(address _farmer, uint256 _amount) external",
  "function claimReimbursement(address _farmer, uint256 _amount, bytes32 _proofOfDelivery) external",
  "function totalSubsidiesDelivered() public view returns (uint256)",
  "function totalLeakagePrevented() public view returns (uint256)",
  "function farmers(address) public view returns (bytes32 hashedId, bool isVerified, uint256 subsidyBalance, uint256 totalReceived)",
  "event FarmerRegistered(address indexed farmer, bytes32 hashedId)",
  "event SubsidyDisbursed(address indexed farmer, uint256 amount)",
  "event ReimbursementClaimed(address indexed dealer, address indexed farmer, uint256 amount, bytes32 proof)"
];

// In a real app, this would be an environment variable
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

export class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;

  async connect() {
    if (typeof window.ethereum !== 'undefined') {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, AGRI_TRACE_ABI, this.signer);
      return true;
    }
    return false;
  }

  async registerFarmer(walletAddress: string, hashedId: string) {
    if (!this.contract) throw new Error("Contract not connected");
    const tx = await this.contract.registerFarmer(walletAddress, hashedId);
    return await tx.wait();
  }

  async disburseSubsidy(farmerAddress: string, amount: string) {
    if (!this.contract) throw new Error("Contract not connected");
    // Convert amount to Wei (assuming 18 decimals for simplicity or just using uint256)
    const amountInWei = ethers.parseEther(amount);
    const tx = await this.contract.disburseSubsidy(farmerAddress, amountInWei);
    return await tx.wait();
  }

  async claimReimbursement(farmerAddress: string, amount: string, proof: string) {
    if (!this.contract) throw new Error("Contract not connected");
    const amountInWei = ethers.parseEther(amount);
    // Ensure proof is a bytes32
    const proofBytes = ethers.isHexString(proof) ? proof : ethers.keccak256(ethers.toUtf8Bytes(proof));
    const tx = await this.contract.claimReimbursement(farmerAddress, amountInWei, proofBytes);
    return await tx.wait();
  }

  async getStats() {
    // For prototype, we'll return mock data if contract is not connected
    if (!this.contract) {
      return {
        totalDelivered: "1,250,000 NGN",
        leakagePrevented: "450,000 NGN"
      };
    }
    
    try {
      const delivered = await this.contract.totalSubsidiesDelivered();
      const leakage = await this.contract.totalLeakagePrevented();
      return {
        totalDelivered: ethers.formatEther(delivered) + " NGN",
        leakagePrevented: ethers.formatEther(leakage) + " NGN"
      };
    } catch (e) {
      return {
        totalDelivered: "0 NGN",
        leakagePrevented: "0 NGN"
      };
    }
  }

  static hashId(id: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(id));
  }
}

export const blockchainService = new BlockchainService();
