//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Patient.sol";
import "./utils/Ownable.sol";

// Contract for Home Page
contract Hospital is Ownable {
    bytes32 password;
    address public patientInstance;
    uint256 public patientCount;

    mapping(bytes32 => address) public patientAddress;
    mapping(uint256 => bytes32) public patientID;

    struct Doctor {
        string doctorName;
        string hospitalName;
        bool authorization;
    }
    mapping(address => Doctor) public doctorInfo;

    constructor() {
        password = 0xc888c9ce9e098d5864d3ded6ebcc140a12142263bace3a23a36f9905f12bd64a; // Password: 123456
    }

    //Function adds new doctor (Only Contract deployer can add)
    function addDoctor(
        string memory _doctorName,
        string memory _hospitalName,
        string memory _password,
        address _doctorAddress
    ) external onlyOwner {
        require(
            !doctorInfo[_doctorAddress].authorization,
            "Doctor already entered"
        );
        require(
            keccak256(abi.encodePacked(_password)) == password,
            "Entered password is wrong"
        );

        Doctor memory newDoctor = Doctor({
            doctorName: _doctorName,
            hospitalName: _hospitalName,
            authorization: true
        });

        doctorInfo[_doctorAddress] = newDoctor;
    }

    //Function to add patient (Only verified doctor can add patient)
    function addPatient(
        string memory _name,
        string memory _dob,
        string memory _bGroup
    ) external {
        require(
            doctorInfo[msg.sender].authorization,
            "The doctor needs to be an authorized user"
        );

        patientID[++patientCount] = keccak256(
            abi.encodePacked(
                block.difficulty,
                block.timestamp,
                _name,
                _bGroup,
                _dob
            )
        );

        Doctor storage dInfo = doctorInfo[msg.sender];

        //Call to Patient's personal records (Contract 2)
        Patient patientContractAddress = new Patient(
            _name,
            _dob,
            _bGroup,
            patientID[patientCount],
            dInfo.doctorName,
            dInfo.hospitalName
        );

        patientAddress[patientID[patientCount]] = address(
            patientContractAddress
        );
        patientInstance = address(patientContractAddress);
    }
}
