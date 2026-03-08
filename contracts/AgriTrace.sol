// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AgriTrace
 * @dev Transparent agricultural subsidy platform for Nigeria.
 * Ensures that subsidies reach verified farmers with blockchain traceability.
 */
contract AgriTrace {
    address public owner;

    struct Farmer {
        bytes32 hashedId;
        bool isVerified;
        uint256 subsidyBalance;
        uint256 totalReceived;
    }

    mapping(address => Farmer) public farmers;
    uint256 public totalSubsidiesDelivered;
    uint256 public totalLeakagePrevented;

    event FarmerRegistered(address indexed farmer, bytes32 hashedId);
    event SubsidyDisbursed(address indexed farmer, uint256 amount);
    event ReimbursementClaimed(address indexed dealer, address indexed farmer, uint256 amount, bytes32 proof);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Register a farmer with a hashed national ID.
     */
    function registerFarmer(address _farmer, bytes32 _hashedId) external onlyOwner {
        require(!farmers[_farmer].isVerified, "Farmer already registered");
        farmers[_farmer].hashedId = _hashedId;
        farmers[_farmer].isVerified = true;
        emit FarmerRegistered(_farmer, _hashedId);
    }

    /**
     * @dev Disburse subsidy to a verified farmer.
     */
    function disburseSubsidy(address _farmer, uint256 _amount) external onlyOwner {
        require(farmers[_farmer].isVerified, "Farmer not verified");
        farmers[_farmer].subsidyBalance += _amount;
        totalSubsidiesDelivered += _amount;
        emit SubsidyDisbursed(_farmer, _amount);
    }

    /**
     * @dev Dealer claims reimbursement after providing goods to a farmer.
     * In a real scenario, this would involve verifying the proof of delivery.
     */
    function claimReimbursement(address _farmer, uint256 _amount, bytes32 _proofOfDelivery) external {
        require(farmers[_farmer].isVerified, "Farmer not verified");
        require(farmers[_farmer].subsidyBalance >= _amount, "Insufficient subsidy balance");
        
        farmers[_farmer].subsidyBalance -= _amount;
        farmers[_farmer].totalReceived += _amount;
        
        // In a real implementation, we would transfer funds to msg.sender (the dealer)
        // For this prototype, we just update the state
        
        emit ReimbursementClaimed(msg.sender, _farmer, _amount, _proofOfDelivery);
    }

    /**
     * @dev Record prevented leakage (e.g., when an unauthorized claim is blocked).
     * This is a simplified version for the prototype.
     */
    function recordPreventedLeakage(uint256 _amount) external onlyOwner {
        totalLeakagePrevented += _amount;
    }
}
