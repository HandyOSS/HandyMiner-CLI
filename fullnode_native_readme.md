

#### How to setup your HSD::

0. checkout #master from github:handshake-org/hsd (```git clone https://github.com/handshake-org/hsd.git```)
1. ```npm install --production```
2. ```npm install github:HandshakeAlliance/hstratum#feature_pow_ng```



#### How to do all this inside my dockerized hsd container!?
1. RUNNING IT::: There's a pre-baked .sh script already here for you to run!
Look inthe folder ```./fullnode_utils```

Linux/Mac CLI: 
```./run.sh myWalletString simnet``` (or main or testnet)

Mac Double Click:
Edit ```run.mac.command``` OR ```run.powng.mac.command``` (simnet) and add your wallet

Windows Double Click:
Edit ```run.windows.bat``` OR ```run.powng.windows.bat``` (simnet) and add your wallet

2. Now that HSD is running, just point your CLI config to 127.0.0.1 port 3008
