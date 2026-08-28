import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("SafeGate Blockchain Layer", function () {
  describe("RevocationRegistry", function () {
    async function deployRegistry() {
      const [owner, backend, other] = await ethers.getSigners();
      const RevocationRegistry = await ethers.getContractFactory("RevocationRegistry");
      const registry = await RevocationRegistry.deploy();
      await registry.waitForDeployment();
      return { registry, owner, backend, other };
    }

    it("does not allow revocation from a non-approved issuer", async function () {
      const { registry, backend } = await deployRegistry();
      const credentialId = ethers.keccak256(ethers.toUtf8Bytes("urn:uuid:rider88-cred"));
      await expect(registry.connect(backend).revoke(credentialId)).to.be.revertedWith(
        "SafeGate: not an approved issuer"
      );
    });

    it("allows an approved issuer to revoke a credential, and isRevoked reflects it", async function () {
      const { registry, owner, backend } = await deployRegistry();
      const credentialId = ethers.keccak256(ethers.toUtf8Bytes("urn:uuid:rider88-cred"));
      await registry.connect(owner).setIssuer(backend.address, true);
      expect(await registry.isRevoked(credentialId)).to.equal(false);
      await registry.connect(backend).revoke(credentialId);
      expect(await registry.isRevoked(credentialId)).to.equal(true);
    });

    it("rejects revoking the same credential twice", async function () {
      const { registry, owner, backend } = await deployRegistry();
      const credentialId = ethers.keccak256(ethers.toUtf8Bytes("urn:uuid:rider12-cred"));
      await registry.connect(owner).setIssuer(backend.address, true);
      await registry.connect(backend).revoke(credentialId);
      await expect(registry.connect(backend).revoke(credentialId)).to.be.revertedWith(
        "SafeGate: already revoked"
      );
    });
  });

  describe("AuditAnchor", function () {
    async function deployAnchor() {
      const [owner, backend, other] = await ethers.getSigners();
      const AuditAnchor = await ethers.getContractFactory("AuditAnchor");
      const anchorContract = await AuditAnchor.deploy();
      await anchorContract.waitForDeployment();
      return { anchorContract, owner, backend, other };
    }

    it("does not allow anchoring from a non-approved anchorer", async function () {
      const { anchorContract, backend } = await deployAnchor();
      const recordHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ orderId: "4521" })));
      await expect(anchorContract.connect(backend).anchor(recordHash)).to.be.revertedWith(
        "SafeGate: not an approved anchorer"
      );
    });

    it("anchors a Guardian decision hash and verifies it correctly", async function () {
      const { anchorContract, owner, backend } = await deployAnchor();
      const decisionRecord = {
        orderId: "4521",
        riderDid: "did:key:z6Mk...rider88",
        action: "COLLECT_COD",
        amount: 1500,
        decision: "APPROVED",
      };
      const recordHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(decisionRecord)));
      await anchorContract.connect(owner).setAnchorer(backend.address, true);
      await anchorContract.connect(backend).anchor(recordHash);
      const [exists, timestamp, anchoredBy] = await anchorContract.verify(recordHash);
      expect(exists).to.equal(true);
      expect(anchoredBy).to.equal(backend.address);
      expect(timestamp).to.be.greaterThan(0);
    });

    it("reports a hash that was never anchored as not existing", async function () {
      const { anchorContract } = await deployAnchor();
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("never-anchored"));
      const [exists] = await anchorContract.verify(fakeHash);
      expect(exists).to.equal(false);
    });

    it("rejects anchoring the exact same hash twice", async function () {
      const { anchorContract, owner, backend } = await deployAnchor();
      const recordHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ orderId: "9999" })));
      await anchorContract.connect(owner).setAnchorer(backend.address, true);
      await anchorContract.connect(backend).anchor(recordHash);
      await expect(anchorContract.connect(backend).anchor(recordHash)).to.be.revertedWith(
        "SafeGate: hash already anchored"
      );
    });
  });
});