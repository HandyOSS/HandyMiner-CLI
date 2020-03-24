HANDYMINER
2020 Alex Smith <alex.smith@earthlab.tech>

### [HandyMiner Quick Start Guide](https://handyminer.github.io/HandyGuide/)

**HandyMiner Team Donation Address (HNS): hs1qwfpd5ukdwdew7tn7vdgtk0luglgckp3klj44f8**

**Quick Links**
[Download Latest from Releases](https://github.com/HandyMiner/HandyMiner-CLI/releases)

[Prerequisites and Installation](#buildInstructions)

[Pool Settings](#poolParameters)

[Fullnode Solo-Mining Setup](#runFullnode)

[FAQ](#faq)

**HandyMiner Social Channels:**

[HandyMiner/HNS Telegram](http://t.me/handshakemining); [Handshake Mining/HNS Discord](https://discord.gg/VMUneym)

**Current Hashrates for King Cobra 0.0.5:**

|  Hashing Algorithm 	|   Maker	|   Model	|  Avg. Hashrate	|  Windows/Linux/MacOS 	|
|---	|---	|---	|---	|---	|
|   Handshake(Blake2bSHA3)	|  AMD 	|  Radeon VII|   384mh	| Yes	
|   Handshake(Blake2bSHA3)	|  AMD 	|  RX 5700XT|   330mh	| Yes	
|   Handshake(Blake2bSHA3)	|  AMD 	|  Vega 64|   310mh	| Yes	
|   Handshake(Blake2bSHA3)	|  AMD 	|  RX 480-580|   150mh	| Yes	
|   Handshake(Blake2bSHA3)  |  AMD  |  RX 580 XFX Black OC|   178mh  | Yes 
|   Handshake(Blake2bSHA3)	|  AMD 	|  RX 5700 (non xt)|  250mh 	| Yes	
|   Handshake(Blake2bSHA3)	|  AMD 	|  RX 570 |   150mh	| Yes	
|   Handshake(Blake2bSHA3)	|  Nvidia 	|  GTX 2080TI|   508mh	| Yes	
|   Handshake(Blake2bSHA3)	|  Nvidia 	|  GTX 2080 Super|   385mh	| Yes	
|   Handshake(Blake2bSHA3)	|  Nvidia 	|  GTX 2070 |   271mh	| Yes	
|   Handshake(Blake2bSHA3)	|  Nvidia 	|  GTX 1080TI |   Pending	| Yes	
|   Handshake(Blake2bSHA3)	|  Nvidia 	|  GTX 1070 |   182mh	| Yes	
|   Handshake(Blake2bSHA3)	|  Nvidia 	|  GTX 1050TI |   73mh	| Yes	
|   Handshake(Blake2bSHA3)	|  Nvidia 	|  Pending |   Pending	| Yes	

**HandyMiner 0.0.5 Release 03/23/2020**
- HNSPool header formatting bug-fix
- Added auto-reconnect for auth-failed error after stratum connects.

**Hangry Mode 0.0.4 Release 03/06/2020::**
- Bug fixes and general enhancements for pool mining stability
- Reported inline with Pool Estimated Hashrates
- Major increases for AMD Vega56/64 and 5700XT
- [Hangry Mode](#hangryInfo) for AMD 5700 for a bonus 25MH

**Previous King Cobra 0.0.3 Release 02/21/2020::**
- Add support for Pool Flare
- Fix memory leak in dashboard chart
- Mac permissions fix
- Update sample config

**Benchmarks and other updated information will be added here as we obtain them from the community**


A simple wrapper for the Blake2bSHA3 (Handshake) PoW OpenCL Miner
to communicate with Handshake HSD via Stratum Mining. 
# Easy Installation
       Easily installed on most rig configurations within minutes.
       Simple GPU Configuration setup.
       Nvidia GeForce 10хх, 16xx and 20xx series and AMD Radeon RX/Polaris/Vega cross-compatible.

### HandyMiner Running with Dashboard Enabled

![Imgur](https://i.imgur.com/0Y3Q5UZ.jpg)

<a id="buildInstructions"></a>
## PREREQUISITES

[Node.js](https://nodejs.org) v10.4 - v11+-ish (whatever one has bigint support)

(**Windows Users**) [Git Bash](https://git-scm.com/downloads) A handy bash terminal, **install in Program Files/Git**

(optional) [Docker](#dockerReminders) if you want to run your own fullnode to mine to with the provided utilities

Linux: OpenCL Drivers and dependencies install can be found in [./linux_installation.md](./linux_installation.md)


## INSTALLATION

#### Download & Install the Prebuilt ZIP :

[Download Latest from Releases](https://github.com/HandyMiner/HandyMiner-CLI/releases)

**Note: un-zipping the full contents may take a bit.**

#### OR BUILD YOURSELF 

#### Build on the Command Line (mac/linux/windows) :

```npm install``` in this directory or 

#### Windows (non-prebuilt only install) : 

double-click ```install.windows.bat``` (and make sure to run this as administrator). Windows: This will probably take 10 minutes to build.

Windows folks: If you didnt double click ```install.windows.bat``` youll need to run the following commands in the repo root: 
```npm install```

<a id="running"></a>
## THE POINT

Non-terminal users: simply double click ```(windows) dashboard.windows.bat``` or ```(mac) dashboard.mac.command``` or ```(linux) dashboard.sh``` files.

**Note:** The first time you launch will run you thru the [miner configurator](#minerConfigurator).

Launch the miner in terminal **in a bash terminal (windows: git-bash)** like:
```
cd (into the repo base)
npm start (runs the CLI miner)

Most terminals:
npm run dashboard //runs the CLI dashboard+miner
OR
./dashboard.sh //same

Note: many windows terminals dont do text coloring or dashboards right with npm run commands.. So if it's an issue (and you didnt double click) you can launch the proper dashboard like:

node --max-old-space-size=8196 ./miner/dashboard.js
```

**Note: Mac users need to enter their password to use the dashboard utility. We're not doing anything weird, MacOS requires it to ask the system for temperature/fan information.**

[Mac FAQs](#macFAQ)

#### Mine blocks!

(Ctrl+C, Q, or ESC to stop the dashboard miner)

<a id="minerConfigurator"></a>
## MINER CONFIGURATOR

The first time you run the miner, you will run through a configurator which will write a config to ./config.json. Should you want to reconfigure in the future, you can just run ```node configure.js``` in this directory. Alternately delete config.json and (re)start the miner.

Required items to have ready for configuration:

0. Host or IP address of the pool or solo node you mine to (127.0.0.1 for your local fullnode)

Optional configuration items (just leave blank and hit enter if you dont know) :
1. Pool or solo node port (probably 3008)
2. The stratum password (optional)

<a id="poolParameters"></a>
## POOL SETTINGS

#### F2POOL

**stratum host**: hns.f2pool.com
**stratum_port**: 6000

non-registered: 
**username**: wallet.workerName
**password**: anything

registered:
**username**: username.workerName
**password**: anything

#### 6block

**stratum host**: handshake.6block.com
**stratum_port**: 7701

**username**: username.workerName
**password**: anything

#### PoolFlare

**stratum host**: hns-us.ss.poolflare.com
**stratum_port**: 3355

**username**: wallet.workerName
**password**: anything

#### hnspool

**stratum host**: stratum-us.hnspool.com
**stratum_port**: 3001

**username**: hnspool_registered_username
**password**: hnspool_registered_password

<a id="advancedOptions"></a>
## Advanced Options:

**App/API developers**: You can run like ```HANDYRAW=true node mine.js``` or set the environment variable ```HANDYRAW=true``` and the miner executable will output raw JSON. The dashboard application is built using the raw CLI JSON output.

**Multiple Configs!**: If you want to use different worker names or pools with the same miner executable, you can pass in your custom config.json into the miner like:
```node mine.js myCustomConfigName.json```
Note the miner will default to config.json without this argument.

<a id="hangryInfo"></a>
**Hangry Mode Update 3/6/2020**::
We released Hangry Mode for Vega56/64 and AMD 5700s. Hangry Mode is enabled by default for Vega 56/64, but can only be enabled for the AMD 5700 as an option (for an extra 25MH bump). Hangry Mode is more-or-less stable for 5700 but can use more power. If you are close to capacity on your PSU it will probably fall over. To enable Hangry Mode for AMD5700:: 
1. You can remove your config.json and run ```node configure.js``` to auto-generate your config.json file with hangry mode enabled, or 
2. add the following line to the end of your existing config.json like::
```
...
"poolDifficulty": -1,
"muteWinningFanfare": false,
"enableHangryMode": true
```

<a id="faq"></a>
## Mining FAQ:

1. I started the dashboard and it says connection to 127.0.0.1 is timed out and trying again in 20s. 
This means your fullnode is not running. Please [launch a fullnode](#runFullnode)  or mine to a pool IP address.

2. I dont see all my GPUs listed in the configurator
Use your arrow keys, the list is scrollable. Hit space to multi-select and Enter to goto the next step. Also ensure that you're updated to the latest version AMD/Nvidia drivers, as older versions may not be recognized.

3. We do not auto-start the fullnode for you here like we do in HandyMiner-GUI. However we made it easy here and its a [double click to start it](#runFullnode). 

4. Windows may also need to add the following two items added to the ```Path``` environment variable:
```
C:\Program Files\nodejs\node_modules\npm\bin
```
<a id="macFAQ"></a>

#### MAC FAQ:

![img](https://i.imgur.com/teYpH3Y.png)

If you have a user-permission error, you'll need to run these commands to get the dashboard running on MacOS Mojave/Catalina. CD into your HandyMiner directory (the folder you downloaded), then run:

```
chmod 755 dashboard.mac.command

Double click dashboard.mac.command
```
To run the miner CLI without the dashboard, you can simply run this command from your HandyMiner folder:
```
sudo node mine.js
```

<a id="runFullnode"></a>
### Running an HSD Fullnode for solo mining

There are some handy docker utilities in the folder ```./fullnode_utils``` which you can double click on mac/windows/linux to create, launch, stop or nuke a stratum-enabled fullnode on your local machine that you can mine to. Any utilities specific to the network (main|testnet|simnet) are noted in the command names. 

<a id="dockerReminders"></a>
#### Docker Fullnode Reminders:
1. Make sure you installed docker. PSA: you dont need to login to docker either, dont let them fool you [mac, hunt for the dmg link](https://docs.docker.com/docker-for-mac/release-notes/) [windows, hunt for the exe link](https://docs.docker.com/docker-for-windows/release-notes/) ). Even after you install it: you dont need to login in order to run this goodness.
2. Make sure that you added your wallet address you'd like paid at to ```run.mac.command OR run.windows.bat OR run.sh (for production)``` or ```run.powng.mac.command OR run.powng.windows.bat OR run.powng.sh (for simnet)``` in the end of the command that looks like: ```"./run.sh hs1qu2zqenh8jdxvaqz7nwun4r3k32klmuf6ss2y9s"```

#### Docker Fullnode FAQs:

1. I get an error:: ``` Error response from daemon: driver failed programming external connectivity on endpoint earthlabHSD (...) Error starting userland proxy: mkdir /port/tcp:0.0.0.0:14038:tcp:172.17.0.2:14038: input/output error Error: failed to start containers: earthlabHSD ``` 
Right click the docker icon in your taskbar and 'restart docker'. It might take a couple minutes to fully restart.

2. Can I access the hsd docker fullnode? 
Yes. Port 15937 will be open for RPC calls to the node per usual, else ssh into the container's hsd directory with::
```docker exec -it earthlabHSD bash```
Windows:
```winpty docker exec -it earthlabHSD bash```

3. I'd like to import my wallet into this fullnode, How do I set my fullnode's API password and/or stratum password to something more meaningful? 

Edit the file you run the fullnode with, ```run.mac.command``` or ```run.windows.bat``` for example, and add the 3rd and 4th parameters into run.sh like:::
```docker start earthlabHSD && docker exec -i earthlabHSD sh -c "./run.sh hs1qu2zqenh8jdxvaqz7nwun4r3k32klmuf6ss2y9s main my_hsd_api_password_here my_stratum_password_here"``` 
and pay attention that the passwords are inside that double quote ^^

4. If you don't want to run a Dockerized fullnode, you can feel free to check the docs in ```fullnode_native_readme.md``` to see how to launch your own native hsd fullnode.


```
       _.-._        _.-._
     _| | | |      | | | |_
    | | | | |      | | | | |
    | | | | |      | | | | |
    | _.-'  | _  _ |  '-._ |
    ;_.-'.-'/`/  \`\`-.'-._;
    |   '    /    \    '   |
     \  '.  /      \  .`  /
      |    |        |    |

```

EPIC Thanks to chjj and the entire Handshake Project

EPIC Thanks to Steven McKie for being my mentor/believing in me
