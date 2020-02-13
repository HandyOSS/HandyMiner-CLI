HANDYMINER
2019 Alex Smith <alex.smith@earthlab.tech>

**HandyMiner Support Telegram Channel:**
[t.me/handshakemining](t.me/handshakemining)

**Updates 02/11/2020::**
- Now supporting variable pool difficulty by setting poolDifficulty to ```-1``` in your config.json
- 6block and hnspool integration fully tested and supported
- Benchmarks and other updated information will be added here as we obtain them from the community: http://shorturl.at/awxHV

A simple wrapper for the Blake2bSHA3 (Handshake) PoW OpenCL Miner
to communicate with Handshake HSD via Stratum Mining. 
# Easy Installation
       Easily installed on most rig configurations within minutes.
       Simple GPU Configuration setup.
       Nvidia GeForce 10хх, 16xx and 20xx series and AMD Radeon RX/Polaris/Vega cross-compatible.


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

### PREREQUISITES

[node.js](https://nodejs.org) v10.4 - v11+-ish (whatever one has bigint support)

(optional) [docker](#dockerReminders) if you want to run your own fullnode to mine to with the provided utilities

(windows) [git bash](https://git-scm.com/downloads) A handy bash terminal

(windows) [mingw-64 8.1.0 with gcc aka "MinGW-W64-install.exe"](https://sourceforge.net/projects/mingw-w64/files/Toolchains%20targetting%20Win32/Personal%20Builds/mingw-builds/8.1.0/threads-posix/dwarf/) bash terminal utilities, please add the installation /bin folder to your Path environment variable

Linux: OpenCL Drivers and dependencies install can be found in [./linux_installation.md](./linux_installation.md)

### HandyMiner Running with Dashboard Enabled

![Imgur](https://i.imgur.com/0Y3Q5UZ.jpg)


### INSTALLATION

#### Command Line (mac/linux/windows) :

```npm install``` in this directory or 

#### Windows: 

double-click ```install.windows.bat``` (and make sure to run this as administrator). Windows: This will probably take 10 minutes to build.


Windows folks: If you didnt double click ```install.windows.bat``` youll need to run the following commands in the repo root: 
```npm install```

Windows may also need to add the following two items added to the ```Path``` environment variable:
```
C:\Program Files\nodejs\node_modules\npm\bin
```

Once you have finished the installer, you can start the miner! Make sure to [start a fullnode](#runFullnode) if you intend on solo mining to 127.0.0.1 to your own hsd fullnode. 
#### Note:
We do not auto-start the fullnode for you here like we do in HandyMiner-GUI. However we made it easy here and its a [double click to start it](#runFullnode). 

### THE POINT

Non-terminal users: simply double click ```(windows) dashboard.windows.bat``` or ```(mac) dashboard.mac.command``` or ```(linux) dashboard.sh``` files.

Note The first time you launch will run you thru the [miner configurator](#configurator).

Launch the miner in terminal like:
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

Note: Mac users need to enter their password to use the dashboard utility. We're not doing anything weird, MacOS requires it to ask the system for temperature/fan information.

#### Mine blocks!

(Ctrl+C, q, or esc to stop the miner)

<a id="minerConfigurator"></a>
### MINER CONFIGURATOR

The first time you run the miner, you will run through a configurator which will write a config to ./config.json. Should you want to reconfigure in the future, you can just run ```node configure.js``` in this directory. Alternately delete config.json and (re)start the miner.

Required Items to have ready for configuration:

0. host or IP address of the pool or solo node you mine to (127.0.0.1 for your local fullnode)

Optional configuration items (just leave blank and hit enter if you dont know) :
1. pool or solo node port (probably 3008)
2. the stratum password (optional)
3. (pool only) pool difficulty (1024 minumum on 6block, 512 minumum on hnspool), or set to -1 for variable difficulty


#### Mining FAQ:

1. I started the dashboard and it says connection to 127.0.0.1 is timed out and trying again in 20s. 
This means your fullnode is not running. Please [launch a fullnode](#runFullnode)  or mine to a pool IP address.

2. I dont see all my GPUs listed in the configurator
Use your arrow keys, the list is scrollable. Hit space to multi-select and Enter to goto the next step.

<a id="runFullnode"></a>
### Running an HSD Fullnode for solo mining

There are some handy docker utilities in the folder ```./fullnode_utils``` which you can double click on mac/windows/linux to create, launch, stop or nuke a stratum-enabled fullnode on your local machine that you can mine to. Any utilities specific to the network (main|testnet|simnet) are noted in the command names. 

<a id="dockerReminders"></a>
#### Docker Fullnode Reminders:
1. Make sure you installed docker. PSA: you dont need to login to docker either, dont let them fool you [mac, hunt for the dmg link](https://docs.docker.com/docker-for-mac/release-notes/) [windows, hunt for the exe link](https://docs.docker.com/docker-for-windows/release-notes/) ). Even after you install it: you dont need to login in order to run this goodness.
2. Make sure that you added your wallet address you'd like paid at to ```run.mac.command OR run.windows.bat OR run.sh (for production)``` or ```run.powng.mac.command OR run.powng.windows.bat OR run.powng.sh (for simnet)``` in the end of the command that looks like: ```"./run.sh hs1qu2zqenh8jdxvaqz7nwun4r3k32klmuf6ss2y9s simnet"```

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
