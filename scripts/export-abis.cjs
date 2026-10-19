const fs = require('fs');
const path = require('path');

const contracts = ['MezoNameRegistry', 'MezoPaymentCore'];
const outDir = path.join(__dirname, '..', 'contracts', 'out');
const abisDir = path.join(__dirname, '..', 'contracts', 'abis');

if (!fs.existsSync(abisDir)) {
    fs.mkdirSync(abisDir, { recursive: true });
}

contracts.forEach(contractName => {
    const artifactPath = path.join(outDir, `${contractName}.sol`, `${contractName}.json`);
    if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        const abiPath = path.join(abisDir, `${contractName}.json`);
        fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
        console.log(`Exported ABI for ${contractName} -> contracts/abis/${contractName}.json`);
    } else {
        console.warn(`Artifact not found for ${contractName} at ${artifactPath}`);
    }
});
