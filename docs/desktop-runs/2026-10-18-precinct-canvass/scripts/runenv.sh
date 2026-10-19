. /mnt/c/Users/User/AppData/Local/Temp/claude/Q--Code---LAPTOP-Code-projects-balotachain/eddf28aa-046c-419f-96ab-1f6c6ce58884/scratchpad/env.sh
export DRIVER=$HOME/Code/saksi/target/saksi-canvass-demo
export DEMO=$HOME/Code/saksi/target/release/saksi-demo
export SAKSI_FABRIC_SAMPLES=$HOME/Code/fabric-samples
ORG=$SAKSI_FABRIC_SAMPLES/test-network/organizations/peerOrganizations/org1.example.com
export FABRIC_TLS_CERT="$ORG/peers/peer0.org1.example.com/tls/ca.crt"
export FABRIC_CERT=$(find "$ORG/users/User1@org1.example.com/msp/signcerts" -type f | head -n1)
export FABRIC_KEY=$(find "$ORG/users/User1@org1.example.com/msp/keystore" -type f | head -n1)
FFLAGS=(--fabric-channel saksi --fabric-tls-cert "$FABRIC_TLS_CERT" --fabric-cert "$FABRIC_CERT" --fabric-key "$FABRIC_KEY")
T8=$HOME/precinct-task8
