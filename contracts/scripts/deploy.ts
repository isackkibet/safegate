import { network } from "hardhat";

const { ethers } = await network.connect();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying SafeGate blockchain layer with account ${deployer.address}`);

  const RevocationRegistry = await ethers.getContractFactory("RevocationRegistry");
  const revocationRegistry = await RevocationRegistry.deploy({ gasLimit: 3_000_000 });
  await revocationRegistry.waitForDeployment();
  console.log("RevocationRegistry deployed to:", await revocationRegistry.getAddress());

  const AuditAnchor = await ethers.getContractFactory("AuditAnchor");
  const auditAnchor = await AuditAnchor.deploy({ gasLimit: 3_000_000 });
  await auditAnchor.waitForDeployment();
  console.log("AuditAnchor deployed to:", await auditAnchor.getAddress());

  const backendSigner = process.env.BACKEND_SIGNER_ADDRESS;
  if (backendSigner) {
    await (await revocationRegistry.setIssuer(backendSigner, true)).wait();
    await (await auditAnchor.setAnchorer(backendSigner, true)).wait();
    console.log("Approved backend signer for revoke + anchor:", backendSigner);
  } else {
    console.log("BACKEND_SIGNER_ADDRESS not set - remember to call setIssuer/setAnchorer once you have it.");
  }

  console.log("\nDeployment summary:");
  console.log({
    RevocationRegistry: await revocationRegistry.getAddress(),
    AuditAnchor: await auditAnchor.getAddress(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});