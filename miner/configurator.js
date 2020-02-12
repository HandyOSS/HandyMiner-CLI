const spawn = require('child_process').spawn;
const fs = require('fs');
process.env.HANDYRAW = true;
process.env.FORCE_COLOR = true;
const inquirer = require('inquirer');

class HandyConfigurator{
	constructor(){
		this.exeName = __dirname+'/../core/cBlakeMiner_multiPlatform';
		this._gpuData;
		this._miningMode = 'solo';
		this._stratumHost = '127.0.0.1';
		this._stratumPort = 3008;
		this._stratumPass = 'earthlab';
		this._stratumUser;
		this._wallet;
		this._muteVictoryFanfare = false;
		this._intensity = 10;
		this._poolDifficulty = 1024;
	}
	configure(callback){
				
		if(process.platform.indexOf('darwin') == 0){
		//  console.log('is mac');
		}
		else if(process.platform.toLowerCase().indexOf('win') == 0){
		  //console.log('windows');
		  this.exeName += '.exe';
		}
		else{
		  //console.log('linux');
		  this.exeName += '_Linux';
		}
		let label = ' \x1b[92mWELCOME TO HANDYMINER CONFIGURATOR\x1b[0m ';
		let label2 = ' \x1b[92mQUERYING GPUS...\x1b[0m ';
		let halfLen1 = Math.floor((process.stdout.columns-1-label.length)/2);
		let halfLen2 = Math.floor((process.stdout.columns-1-label2.length)/2);

		let h0_0 = '';
		let h0_1 = '';
		let h1_0 = '';
		let h1_1 = '';
		for(let i=0;i<halfLen1;i++){
			h0_0 += '#';
			h0_1 += '#';
		}
		label = h0_0+label+h0_1;
		for(let i2=0;i2<halfLen2;i2++){
			h1_0 += '#';
			h1_1 += '#';
		}
		label2 = h1_0 + label2 + h1_1;

		this.rainbow();
		console.log(label);
		console.log(label2);

		/*var lines = process.stdout.getWindowSize()[1];
		//console.log('lines',lines);
		for(var i = 0; i < lines-14; i++) {
		    console.log('\r\n');
		}*/
		let allOpts = [];
		let psDone = 0;
		let psTarget = 3;
		for(let i=0;i<psTarget;i++){
		  let ps = spawn(this.exeName,[-1,i]);
		  let psAll = '';
		  ps.stdout.on('data',(d)=>{
		  	psAll += d.toString('utf8');
		    //console.log('data out isset',d.toString('utf8'));
		  })
		  /*ps.stderr.on('data',d=>{
		  	psDone++;
		  })*/
		  ps.on('close',d=>{
		  	psDone++;
		  	//console.log('ps done',psAll);
		  	psAll.split('\n').map(line=>{
		  		let lineD;
		  		try{
		  			lineD = JSON.parse(line);
		  		}
		  		catch(e){

		  		}
		  		if(lineD){
		  			if(lineD.event == 'registerDevice'){
		  				allOpts.push(lineD);
		  			}
		  		}
		  	});
		  	if(psDone == psTarget){
			  	let choices = {};
			  	let gpus = allOpts.sort((a,b)=>{
			  		return (b.platform-a.platform);
			  	}).map(d=>{
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
		            if(d.name.indexOf('Intel') >= 0 && d.name.indexOf('HD Graphics') >= 0){
		            	//format warning here
		            	name = '\x1b[33m'+d.name+' (note: This GPU renders graphics, mining will impact performance...)\x1b[0m' 
		            }
			  		let key = name+' ID:'+d.id+' Platform:'+d.platform;//+' Mfg: '+d.manufacturer;
			  		choices[key] = d;
			  		return key;
			  	})
				inquirer
				  .prompt([
				    {
				      type: 'checkbox',
				      name: 'gpus',
				      message: 'Choose Your GPUs (up|down arrows to scroll)',
				      choices: gpus
				    },
				    {
				    	type:'list',
				    	name: 'miningMode',
				    	message: 'Set a Mining Mode',
				    	choices:[
				    		'Pool',
				    		'Solo'
				    	]
				    },
				    {
				    	name:'stratumHost',
				    	message:'Stratum Host: (127.0.0.1)'
				    },
				    {
				    	name:'stratumPort',
				    	message:'Stratum Port: (3008)'
				    },
				    {
				    	name:'stratumUser',
				    	message:'Stratum User: (optional)'
				    },
				    {
				    	name:'stratumPass',
				    	message:'Stratum Password: (earthlab)'
				    },
				    /*{
				    	name:'wallet',
				    	message:'Wallet: (only required for some pools)'
				    },*/
				    {
				    	name:'intensity',
				    	type:'list',
				    	message:'Mining Intensity',
				    	choices:[
				    		'1 - This is an ancient GPU',
				    		'4 - This is an older GPU',
				    		'6 - Are we there yet?',
				    		'7 - Integrated GPUs here and below',
				    		'8 - I want to use my laptop still',
				    		'9 - I want to use my laptop less',
				    		'10 - Most 4GB cards',
				    		'11 - Beast Mode: New-ish 8GB+ GPUs'
				    	]
				    },
				    {
				    	name:"fanfare",
				    	type:"list",
				    	message:'Mute Winning Block Fanfare Song!?!1!',
				    	choices:[
				    		'I would love some block fanfare, please.',
				    		'I dont like celebrating, mute the epic fanfare.'
				    	]
				    }
				  ])
				  .then(answers => {
				  	let data = answers.gpus.map(k=>{
				  		return choices[k];
				  	});
				  	this._gpuData = data;
				  	if(answers.stratumPass != ''){
				  		this._stratumPass = answers.stratumPass;
				  	}
				  	if(answers.stratumHost != ''){
				  		this._stratumHost = answers.stratumHost;
				  	}
				  	/*if(answers.wallet != ''){
				  		this._wallet = answers.wallet;
				  	}*/
				  	if(answers.stratumPort != ''){
				  		let port;
				  		try{
				  			port = parseInt(answers.stratumPort);
				  		}
				  		catch(e){
				  			port = answers.stratumPort;
				  		}
				  		this._stratumPort = port;
				  	}


				  	this._miningMode = answers.miningMode.toLowerCase();
				  	//console.log('intensity',answers.intensity);
				  	this._intensity = parseInt(answers.intensity.split('-')[0].trim()) || 10;
				  	let gpuString = [];
				  	let platformString = [];
				  	data.map(gpu=>{
				  		gpuString.push(gpu.id);
				  		platformString.push(gpu.platform);
				  	})
				  	gpuString = gpuString.join(',');
				  	platformString = platformString.join(',');
				  	let now = new Date();
				  	if(answers.stratumUser == ''){
				  		this._stratumUser = "miner"+now.getTime()+'_'+(Math.floor(Math.random()*1000+Math.random()*1000));
				  	}
				  	else{
				  		this._stratumUser = answers.stratumUser;
				  	}
				  	if(answers.fanfare.indexOf('I would love') == 0){
				  		this._muteVictoryFanfare	= false;
				  	}
				  	else{
				  		this._muteVictoryFanfare	= true;
				  	}
				  	let config = {
				  		"gpus":gpuString,
						"gpu_platform":platformString,
						"gpu_mfg":"unikern",
						"intensity":this._intensity,
						"host":this._stratumHost,
						"port":this._stratumPort,
						"stratum_user":this._stratumUser,
						"stratum_pass":this._stratumPass,
						//"wallet":this._wallet,
						"mode":this._miningMode,
						"poolDifficulty":this._poolDifficulty,
						"muteWinningFanfare":this._muteVictoryFanfare
				  	}
				  	if(this._miningMode == 'pool'){
				  		inquirer.prompt([{
				  			name:'pooldiff',
				  			message:'Pool Difficulty (1024, set to -1 for dynamic)'
				  		}]).then(pda=>{
				  			//console.log('pool diff answer',pda.pooldiff);
				  			if(pda.pooldiff != ''){
				  				config.poolDifficulty = parseInt(pda.pooldiff);
				  			}
				  			this.saveConfig(config, callback);
				  			//console.info('Answer:', JSON.stringify(config,null,2));
				  		});
				  		
				  	}
				  	else{
				  		this.saveConfig(config, callback);
				  		//console.info('Answer:', JSON.stringify(config,null,2));
				  	}

				  	//now prompt for pool info
				  	//promptPoolInfo();
				    
				  });
			}
		  	//console.log('psdone',psDone,allOpts.length);
		  });
		}

	}
	saveConfig(config, callback){
		let configPath = __dirname+'/../config.json';
		let d = new Date();
		let path = 'config_'+d.getDay()+'_'+d.getMonth()+'_'+d.getHours()+'_'+d.getMinutes()+'.json';
			
		let label = ' \x1b[92mMOVING EXISTING config.json TO '+path+'\x1b[0m ';
		let label2 = ' \x1b[92mWROTE NEW CONFIGURATION TO config.json\x1b[0m ';
		let label3 = ' \x1b[92m COMMENCING MINING! \x1b[0m '
		let halfLen1 = Math.floor((process.stdout.columns-1-label.length)/2);
		let halfLen2 = Math.floor((process.stdout.columns-1-label2.length)/2);
		let halfLen3 = Math.floor((process.stdout.columns-1-label3.length)/2);

		let h0_0 = '';
		let h0_1 = '';
		let h1_0 = '';
		let h1_1 = '';
		let h2_0 = '';
		let h2_1 = '';

		for(let i=0;i<halfLen1;i++){
			h0_0 += '#';
			h0_1 += '#';
		}
		label = h0_0+label+h0_1;
		for(let i2=0;i2<halfLen2;i2++){
			h1_0 += '#';
			h1_1 += '#';
		}
		label2 = h1_0 + label2 + h1_1;
		for(let i3=0;i3<halfLen3;i3++){
			h2_0 += '#';
			h2_1 += '#';
		}
		label3 = h2_0 + label3 + h2_1;
		let p1 = '';
		let p2 = '';
		for(let pi=0;pi<process.stdout.columns-1;pi++){
			p1 += '#';
			p2 += '#';
		}
		//this.rainbow();
		console.log(p1);
		console.log(label);
		console.log(label2);
		console.log(label3);
		console.log(p2);

		fs.readFile(configPath,(err,data)=>{
			if(!err){
				//config exists, move to backup
				fs.writeFileSync(path,data.toString('utf8'));
				fs.writeFileSync(configPath,JSON.stringify(config,null,2));
			}
			else{
				//brand new
				fs.writeFileSync(configPath,JSON.stringify(config,null,2));
			}
			callback();
		});
		
		
	}
	rainbow(){

		console.log('                         \x1b[95m_________\x1b[0m')
		console.log('                      \x1b[95m.##\x1b[0m\x1b[36m@@\x1b[0m\x1b[32m&&&&\x1b[0m\x1b[36m@@\x1b[0m\x1b[95m##.\x1b[0m')
		console.log('                   \x1b[95m,##\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m::\x1b[0m\x1b[38;5;9m%&&&%%\x1b[0m\x1b[33m::\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m##.\x1b[0m')
		console.log('                  \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%%\x1b[0m\x1b[38;5;1mHANDYMINER\x1b[0m\x1b[38;5;9m%%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('                \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m00\'\x1b[0m         \x1b[38;5;1m\'00\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('               \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\'\x1b[0m             \x1b[38;5;1m\'0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('              \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                 \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('             \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                   \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		console.log('             \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                   \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
		//console.log('             \x1b[95m"\x1b[0m" \x1b[33m\'\x1b[0m "                   " \' "\x1b[95m"\x1b[0m')
		console.log('           \x1b[33m_oOoOoOo_\x1b[0m                    \x1b[92mTHE\x1b[0m ')
		console.log('          (\x1b[33moOoOoOoOo\x1b[0m)                \x1b[92mHANDSHAKE\x1b[0m')
		console.log('           )\`"""""\`(                 \x1b[92mCOMMUNITY\x1b[0m')
		console.log('          /          \\              ')   
		console.log('         |    \x1b[92mHNS\x1b[0m     |              ')
		console.log('         \\           /              ')
		console.log('          \`=========\`')
		console.log('')
		console.log('');
	}

}
module.exports = HandyConfigurator;
