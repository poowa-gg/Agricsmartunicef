// SPDX-License-Identifier: MIT
// Copyright (c) 2026 AgriSmart Connect
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

pragma solidity ^0.8.19;

/**
 * @title AgriTrace
 * @dev Transparent agricultural subsidy platform for Nigeria.
 * Follows Data Minimization principles by using hashed identifiers.
 */
contract AgriTrace {
    address public admin;
    
    struct Farmer {
        bytes32 hashedId; // Keccak-256 hash of national ID or unique identifier
        bool isVerified;
        uint256 subsidyBalance;
        uint256 totalReceived;
    }

    struct Transaction {
        address farmerAddress;
        address dealerAddress;
        uint256 amount;
        uint256 timestamp;
        bytes32 proofOfDelivery; // Hash of the delivery confirmation
    }

    mapping(address => Farmer) public farmers;
    mapping(address => bool) public agroDealers;
    Transaction[] public transactions;

    uint256 public totalSubsidiesDelivered;
    uint256 public totalLeakagePrevented; // Calculated based on blocked unauthorized claims

    event FarmerRegistered(address indexed farmer, bytes32 hashedId);
    event SubsidyDisbursed(address indexed farmer, uint256 amount);
    event ReimbursementClaimed(address indexed dealer, address indexed farmer, uint256 amount, bytes32 proof);
    event DealerAuthorized(address indexed dealer, bool status);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyDealer() {
        require(agroDealers[msg.sender], "Only authorized agro-dealers can claim");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function authorizeDealer(address _dealer, bool _status) external onlyAdmin {
        agroDealers[_dealer] = _status;
        emit DealerAuthorized(_dealer, _status);
    }

    function registerFarmer(address _farmer, bytes32 _hashedId) external onlyAdmin {
        require(!farmers[_farmer].isVerified, "Farmer already registered");
        farmers[_farmer] = Farmer({
            hashedId: _hashedId,
            isVerified: true,
            subsidyBalance: 0,
            totalReceived: 0
        });
        emit FarmerRegistered(_farmer, _hashedId);
    }

    function disburseSubsidy(address _farmer, uint256 _amount) external onlyAdmin {
        require(farmers[_farmer].isVerified, "Farmer not verified");
        farmers[_farmer].subsidyBalance += _amount;
        emit SubsidyDisbursed(_farmer, _amount);
    }

    /**
     * @dev Agro-dealers claim reimbursement after providing goods to farmers.
     * Requires a proof of delivery (e.g., a hash of a signed receipt).
     */
    function claimReimbursement(address _farmer, uint256 _amount, bytes32 _proofOfDelivery) external onlyDealer {
        require(farmers[_farmer].isVerified, "Farmer not verified");
        require(farmers[_farmer].subsidyBalance >= _amount, "Insufficient subsidy balance");
        
        farmers[_farmer].subsidyBalance -= _amount;
        farmers[_farmer].totalReceived += _amount;
        totalSubsidiesDelivered += _amount;

        transactions.push(Transaction({
            farmerAddress: _farmer,
            dealerAddress: msg.sender,
            amount: _amount,
            timestamp: block.timestamp,
            proofOfDelivery: _proofOfDelivery
        }));

        emit ReimbursementClaimed(msg.sender, _farmer, _amount, _proofOfDelivery);
    }

    function getStats() external view returns (uint256 delivered, uint256 leakage) {
        return (totalSubsidiesDelivered, totalLeakagePrevented);
    }
}
