//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

//Contract to view records and ability to add new ones
contract Patient {
    uint256 public recordCount;
    address public addr;
    string recordHash;

    struct PatientStruct {
        string name;
        string dob;
        string bGroup;
        bytes32 id;
    }
    PatientStruct public patient;

    struct DoctorStruct {
        string doctorName;
        string hospitalName;
    }
    DoctorStruct public doctor;

    struct RecordStruct {
        string recordHash;
        string doctorName;
        string hospitalName;
    }
    mapping(uint256 => RecordStruct) public patientRecords;

    constructor(
        string memory _name,
        string memory _dob,
        string memory _bGroup,
        bytes32 _id,
        string memory _doctor,
        string memory _hospital
    ) {
        PatientStruct memory newPatient = PatientStruct({
            name: _name,
            dob: _dob,
            bGroup: _bGroup,
            id: _id
        });
        patient = newPatient;

        DoctorStruct memory newDoctor = DoctorStruct({
            doctorName: _doctor,
            hospitalName: _hospital
        });
        doctor = newDoctor;
    }

    //function to add a new record (call to the 3rd contract)
    function addRecord(string memory _recordHash) public {
        recordHash = _recordHash;
        DoctorStruct storage doctorInfo = doctor;

        RecordStruct memory newRecord = RecordStruct({
            recordHash: _recordHash,
            doctorName: doctorInfo.doctorName,
            hospitalName: doctorInfo.hospitalName
        });

        patientRecords[++recordCount] = newRecord;
    }

    function getParticularRecord(uint256 _index)
        public
        view
        returns (RecordStruct memory)
    {
        return patientRecords[_index];
    }
}
