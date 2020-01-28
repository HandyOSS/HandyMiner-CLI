If you dont want to use the docker fullnode utilities and run the fullnode on your native environment you'll need to do the following tweaks during simnet/powng mining.
###simnet infos 

####simnet peer key:::
```aorsxa4ylaacshipyjkfbvzfkh3jhh4yowtoqdt64nzemqtiw2whk```

####simnet stratum hsd: 
```3.14.224.108```

####simnet hsd mining stratum port: 
```3008```

####rpc syntax for adding as a peer:
```https://handshake-org.github.io/api-docs/#addnode```

####data for rpc call:
```{"method":"addnode","params":["aorsxa4ylaacshipyjkfbvzfkh3jhh4yowtoqdt64nzemqtiw2whk@3.14.224.108:15038","add"]}```

####curl command to add sync the chain via rpc:
```curl x:hsd_api_pass_here@127.0.0.1:15037 -XPOST --data '{\"method\":\"addnode\",\"params\":[\"aorsxa4ylaacshipyjkfbvzfkh3jhh4yowtoqdt64nzemqtiw2whk@3.14.224.108:15038\",\"add\"]}'```

####How to setup your HSD::

0. checkout #pow-ng from github:handshake-org/hsd (```git clone https://github.com/handshake-org/hsd.git```)
1. ```npm install --production```
2. ```npm install github:HandshakeAlliance/hstratum#feature_pow_ng```



####How to do all this inside my dockerized hsd container!?
1. RUNNING IT::: There's a pre-baked .sh script already here for you to run!
Look inthe folder ```./fullnode_utils```

Linux/Mac CLI: 
```./run.sh myWalletString simnet```

Mac Double Click:
Edit ```run.mac.command``` OR ```run.powng.mac.command``` (simnet) and add your wallet

Windows Double Click:
Edit ```run.windows.bat``` OR ```run.powng.windows.bat``` (simnet) and add your wallet

2. Now that HSD is running, just point your CLI config to 127.0.0.1 port 3008
