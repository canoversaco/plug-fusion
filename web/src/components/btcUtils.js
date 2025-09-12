// src/btcUtils.js
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";

// ECPair für bitcoinjs v6+:
const ECPair = ECPairFactory(ecc);

export function generateWallet() {
  const keyPair = ECPair.makeRandom();
  const { address } = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey });
  const privKeyWIF = keyPair.toWIF();
  return { address, privKeyWIF };
}
