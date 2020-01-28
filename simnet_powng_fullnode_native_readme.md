If you dont want to use the docker fullnode utilities and run the fullnode on your native environment you'll need to do the following tweaks during simnet/powng mining.

Note, you'll want to sync with the fullnode listed below if you want a gpu-mine-able chain. 

###If you want to build your own simnet chain out of the box and not sync: 

1. start the HSD cpu miner with 'setgenerate'. This is necessary because the difficulty is far too easy in simnet out of the box for the GPU and the memory will have race conditions. You'd see a tooon of 'stale share' errors if you tried the GPU miner right away. Syncing to the node listed below has a real-world difficulty going so you dont have to spend a couple hours getting it there. But if you really want: 

2. To start cpu mining: ```curl x:hsd_api_key@127.0.0.1 -xPOST --data '{"method":"setgenerate","params":[1,2]}'```, where 2 is the # of miner threads. To stop cpu mining:```curl x:hsd_api_key@127.0.0.1 -xPOST --data '{"method":"setgenerate","params":[0,0]}'```

3. Once CPU mining has slowed to some reasonable level you can kick on the GPU. Start out at difficulty 0 or 1 and work your way up to 11 in the miner. You can edit config.json setting for "intensity". If you get too many 'stale share' errors on the miner end you know you have the intensity setting up too high. Basically a race condition where if one of every 10 nonces were a block solution we'd have maybe 400K correct nonces at intensity 5 per each GPU run of the algo. This causes some messed up level of race condition we just dont see in real-life difficulty mining. Again, much easier to use the simnet below as a peer. 


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
