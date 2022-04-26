const fs = require('fs');
const ethers = require("ethers");

//
// configuration
//
// use for simulation testing (hardhat)
const WS_RPC              = 'http://127.0.0.1:8545/';
const provider = new ethers.providers.WebSocketProvider(WS_RPC);
// use running on mainnet (RPC)
// const WS_RPC              = 'ws://192.168.1.111:8546/';
// const provider = new ethers.providers.JsonRpcProvider(WS_RPC);
const CHAINLOG            = "0xdA0Ab1e0017DEbCd72Be8599041a2aa3bA7e740F";
const MAX_GAS_LIMIT       = ethers.utils.parseUnits('10000000', 'wei');
const GAS                 = ethers.utils.parseUnits('1000000', 'wei');

//
// CONFIG ABOVE, DO NOT CHANGE CODE BELOW LINE
//

// block mutex
let onBlockMutex = false;

// wallet
const privateKey = fs.readFileSync('./secrets/private.key');
const signer = new ethers.Wallet(privateKey.toString('utf8'), provider);

// contracts
const chainLogABI = JSON.parse(fs.readFileSync('./abi/ChainLog.abi').toString());
const chainlog = new ethers.Contract(CHAINLOG, chainLogABI, signer);

const flashKillerABI = JSON.parse(fs.readFileSync('./abi/FlashKiller.abi').toString());
const flashMintABI = JSON.parse(fs.readFileSync('./abi/FlashMint.abi').toString());

async function checkFlashKiller(flashKiller, _overrides) {
  try {
    const flashAddress = await flashKiller.flash();
    const flashMint = new ethers.Contract(flashAddress, flashMintABI, signer);

    const max = await flashMint.max();

    if (max.eq(0)) {
      console.log("FlashMint already disabled.");
      return;
    }

    _overrides.gasLimit = await flashKiller.estimateGas.kill(_overrides);

    if (_overrides.gasLimit.gt(MAX_GAS_LIMIT)) {
      console.log(
        'checkFlashKiller: gasLimit too high: ' +
          _overrides.gasLimit + ' > ' + MAX_GAS_LIMIT
      );
      return;
    }

    await flashKiller.callStatic.kill(_overrides);

    // everything beyond here is a real call
    console.log('checkFlashKiller: flashKiller.kill()');
    const tx = await flashKiller.kill(_overrides);
    console.log(tx);
    const receipt = await tx.wait();
    console.log(receipt);
  } catch (err) {
    // standard path lands here, uncomment to debug
    // console.error(err);
    return;
  }
}

async function onBlock(blockNumber) {
  console.log('onBlock: block number ' + blockNumber);

  if (onBlockMutex) {
    console.log('onBlock: already processing a block, exiting...');
    return;
  }

  provider.off("block");
  onBlockMutex = true;

  const flashKillerAddress = await chainlog.getAddress(
    ethers.utils.formatBytes32String('FLASH_KILLER')
  );
  const flashKiller = new ethers.Contract(
    flashKillerAddress, flashKillerABI, signer
  );

  // debugging gas price
  //
  // let fee = await provider.getFeeData()
  // console.log(
  //   'gasPrice: ' + ethers.utils.formatUnits(fee.gasPrice, "gwei")
  // );
  // console.log(
  //   'maxFeePerGas: ' + ethers.utils.formatUnits(fee.maxFeePerGas, "gwei")
  // );
  // console.log(
  //   'maxPriorityFeePerGas: ' + ethers.utils.formatUnits(fee.maxPriorityFeePerGas, "gwei")
  // );

  // All overrides are optional
  let overrides = {
      gasLimit: GAS
  };

  await checkFlashKiller(flashKiller, overrides);

  onBlockMutex = false;
  return provider.on("block", onBlock);
}

provider.on("block", onBlock);
