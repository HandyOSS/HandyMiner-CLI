const blessed = require('blessed');
const contrib = require('blessed-contrib');
const moment = require('moment');
const numeral = require('numeral');
const hrInit = process.env.HANDYRAW;
//const HandyMiner = require('./HandyMiner.js');
const Configurator = require('./configurator.js');
const spawn = require('child_process').spawn;
const fs = require('fs');


class CLIDashboard{
	constructor(){
		//UPDATE POWER TABLE WITH NEW GPUs
		this.gpuPowerTable = {
			watts:{
				1050:75,
				1060:90,
				1070:130,
				1080:150,
				1660:100,
				2060:130,
				2070:150,
				2080:190,
				'RX480/580':80,
				'RX Vega':200,
				'VII':250,
				'5700':200,
				'5700XT':200
			}
		}
		this.linechartTicksMax = 50;
		this.gridWidth = 8;
		//console.log('new dashboard');
		this.colors = ["#FF0000","#FFFF00","#00FF00","#0000FF","#FF00FF","#00FFFF"]
		//this.colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
		//this.colors = [[255,0,0],[255,255,0],[0,255,0],[0,0,255],[0,255,255],[255,0,255],[255,200,10],[31,119,180],[255,127,14],[44,160,44],[214,39,40],[148,103,189],[140,86,75],[227,119,194],[127,127,127],[188,189,34],[23,190,207]];
		this.statsData = {
			shares:0,
			errors:0,
			last:undefined,
			started:moment(),
			hashrate:0,
			hashrate120:0,
			target:0,
			difficulty:0
		}

	  //grid.set(row, col, rowSpan, colSpan, obj, opts)
	  //var box = grid.set(0, 0, 4, 4, blessed.box, {content: 'My Box'})
	 	//this.allTemps = new 
	  //this.screen.render();
		
    	fs.readFile(__dirname+'/../config.json',(err,data)=>{
			if(!err){
				this.config = JSON.parse(data.toString('utf8'));
				//console.log('starting miner')
				this.startMiner();
				this.initBlessed();
				this.startPowerTimer();
			}
			else{
				//console.log('err',err.toString('utf8'));
				const configurator = new Configurator();
				configurator.configure(()=>{
					this.config = JSON.parse(fs.readFileSync(__dirname+'/../config.json','utf8'));
					//let miner = new HandyMiner();
					this.startMiner();
					this.initBlessed();
					this.startPowerTimer();

				});
			}		
		});
		
	}
	initBlessed(){
		this.screen = blessed.screen();
		this.grid = new contrib.grid({rows: 4, cols: this.gridWidth, screen: this.screen})
		let _this = this;
	    this.screen.key(['escape', 'q', 'C-c'], (ch, key)=> {
		  	
		  	this.screen.destroy();
		  	
		  	this.rainbow();
		  	if(typeof this.minerProcess != "undefined"){
		  		this.minerProcess.stdin.pause();
		  		this.minerProcess.kill();
		  		
		  	}
		  	return process.exit(0);
	    });
	}
	startPowerTimer(){
		this.powerTimer = setTimeout(()=>{
			if(process.platform.indexOf('darwin') >= 0){
				this.getPowerMetricsMac();
			}
			else if(process.platform.toLowerCase().indexOf('win32') >= 0){
				this.getPowerMetricsWin();	
			}
			else {
				//linux then
				this.getPowerMetricsLinux();
			}
			this.updatePowerChart();
			this.updateFanChart();
			this.updateSparkLines();
			this.startPowerTimer();
		},10000);
		

	}
	updateSparkLines(){
		let memSpeedLabels = [];
		let memSpeedDatas = [];
		if(typeof this.gpus == "undefined") return;
		Object.keys(this.gpus).map(k=>{
			let gpu = this.gpus[k];
			let name = gpu.info.name;
			let data = [];
			let last = 0;
			let mData = gpu.data.gpuMemoryClock;
			if(mData.length > this.linechartTicksMax){
				mData = mData.slice(mData.length-(this.linechartTicksMax/2),mData.length);
				this.gpus[k].data.gpuMemoryClock = mData;
			}
			mData = mData.map(d=>{return d.clock;});
			data = mData;
			last = mData[mData.length-1] || 0;
			memSpeedLabels.push(name+' \x1b[36m'+last+'MHz\x1b[0m');
			memSpeedDatas.push(data);
			//console.log('mespeed data',data);
		});
		//console.log('memspeedLabels',memSpeedLabels);
		this.memSpeedArea.setData(memSpeedLabels,memSpeedDatas);

		let gpuSpeedLabels = [];
		let gpuSpeedDatas = [];
		if(typeof this.gpus == "undefined") return;
		Object.keys(this.gpus).map(k=>{
			let gpu = this.gpus[k];
			let name = gpu.info.name;
			let data = [];
			let last = 0;
			let mData = gpu.data.gpuCoreClock;
			if(mData.length > this.linechartTicksMax){
				mData = mData.slice(mData.length-(this.linechartTicksMax/2),mData.length);
				this.gpus[k].data.gpuCoreClock = mData;
			}
			mData = mData.map(d=>{return d.clock;});
			data = mData;
			last = mData[mData.length-1] || 0;
			gpuSpeedLabels.push(name+' \x1b[36m'+last+'MHz\x1b[0m');
			gpuSpeedDatas.push(data);

		});
		//console.log('gpuspeedLabels',gpuSpeedLabels);
		this.gpuSpeedArea.setData(gpuSpeedLabels,gpuSpeedDatas);

		let voltageLabels = [];
		let voltageDatas = [];
		if(typeof this.gpus == "undefined") return;
		Object.keys(this.gpus).map(k=>{
			let gpu = this.gpus[k];
			let name = gpu.info.name;
			let data = [];
			let last = 0;

			let mData = process.platform.indexOf('linux') >= 0 ? gpu.data.power : gpu.data.voltage;
			if(mData.length > this.linechartTicksMax){
				mData = mData.slice(mData.length-(this.linechartTicksMax/2),mData.length);
				if( process.platform.indexOf('linux') >= 0){
					this.gpus[k].data.power = mData;
				}
				else{
					this.gpus[k].data.voltage = mData;
				}
				
			}
			mData = mData.map(d=>{return process.platform.indexOf('linux') >= 0 ? d.power : d.voltage*1000;});
			data = mData;
			last = mData[mData.length-1] || 0;
			//console.log('voltage datas',data);
			let label = process.platform.indexOf('linux') >= 0 ? 'W' : 'mV';
			voltageLabels.push(name+' \x1b[36m'+(last)+label+'\x1b[0m');
			voltageDatas.push(data)
		});
		//console.log('voltageLabels',voltageLabels);
		this.voltageSpeedArea.setData(voltageLabels,voltageDatas);
	}
	updateFanChart(){
		//update fan sparkline
		let eV = [];
	 	let fV = [];
	 	let energySum = 0;
	 	let fanSum = 0;
	 	let fanCount = 0;
	 	if(typeof this.gpus == "undefined"){
	 		return;
	 	}
	 	Object.keys(this.gpus).map((k,i)=>{
	 		let gpu = this.gpus[k];
	 		if(gpu.data.power.length > this.linechartTicksMax){
	 			this.gpus[k].data.power = this.gpus[k].data.power.slice(this.gpus[k].data.power.length-this.linechartTicksMax/2,this.gpus[k].data.power.length);
	 		}
	 		if(gpu.data.fan.length > this.linechartTicksMax){
	 			this.gpus[k].data.fan = this.gpus[k].data.fan.slice(this.gpus[k].data.fan.length-this.linechartTicksMax/2,this.gpus[k].data.fan.length);
	 		}
	 		if(i == 0){
	 			eV = gpu.data.power.map(d=>{return d.power;});
	 			if(process.platform.indexOf('linux') >= 0 || process.platform.indexOf('darwin') >= 0){
	 				fV = gpu.data.fan.map(d=>{return d.fans;});
	 			}
	 			else{
	 				fV = gpu.data.fan.map(d=>{return d.fans/255*100;});	
	 			}
	 			
	 		}
	 		else{
	 			gpu.data.power.map((v,ii)=>{
	 				if(typeof eV[ii] != "undefined"){
	 					eV[ii] += v.power;
	 				}
	 			})
	 			gpu.data.fan.map((v,ii)=>{
	 				if(typeof fV[ii] != "undefined"){
	 					if(process.platform.indexOf('linux') >= 0 || process.platform.indexOf('darwin') >= 0){
	 						fV[ii] += v.fans;
	 					}
	 					else{
	 						fV[ii] += v.fans/255*100;	
	 					}
	 					
	 				}
	 			})
	 		}
	 	});
	 	if(eV.length > this.linechartTicksMax){
	 		eV = eV.slice(eV.length-(this.linechartTicksMax/2),eV.length);
	 		//this.gpus[k].data.power = this.gpus[k].data.power.slice(eV.length-500,eV.length);
	 	}
	 	if(fV.length > this.linechartTicksMax){
	 		fV = fV.slice(fV.length-(this.linechartTicksMax/2),fV.length);

	 		//this.gpus[k].data.fan = this.gpus[k].data.fan.slice(fV.length-500,fV.length);
	 	}
	 	let eVLast = eV[eV.length-1] || 0;
	 	let fVLast = fV[fV.length-1] || 0;
	 	eVLast = Math.floor(eVLast);
	 	fVLast = Math.round(fVLast/Object.keys(this.gpus).length);
	  this.energyArea.setData(['Energy \x1b[36m'+eVLast+'W\x1b[0m','Avg Fan Speed \x1b[36m'+(Math.floor(fVLast))+'%\x1b[0m'],[eV,fV]);
	}
	updatePowerChart(){
		let xNow = moment();
	    let tempSeriesData = [];
	    //console.log('draw hashrate');
	    //return false;
	    if(typeof this.gpus == "undefined"){
	    	return;
	    }
	    Object.keys(this.gpus).map(gpuKey=>{
	    	let gpuData = this.gpus[gpuKey];
	    	let name = gpuData.info.name;
	    	let tempData = gpuData.data.temperature;
	    	let xData = [];
		    let yData = [];
		    let xData2 = [];
		    let yData2 = [];
		    if(tempData.length > this.linechartTicksMax){
		    	tempData = tempData.slice(tempData.length-(this.linechartTicksMax/2),tempData.length);
		    	this.gpus[gpuKey].data.temperature = tempData;
		    }
		    tempData.map((d,i)=>{

		    	yData.push(d.temperature);
		    	let modRate = 100;
		    	if(tempData.length < this.linechartTicksMax){
		    		modRate = 10;
		    	}
		    	if(tempData.length < this.linechartTicksMax/2){
		    		modRate = 5;
		    	}
		    	if(tempData.length < this.linechartTicksMax/4){
		    		modRate = 2;
		    	}
		    	xData.push(i % modRate == 0 ? d.time : ' ');
		    })
		    //console.log('xData',xData);
		    /*for(let i=0;i<20;i++){
		    	let t = xNow.clone().subtract(20-i,'minutes');
		    	xData.push(i % 5 == 0 ? t.format('HH:mm') : ' ');
		    	xData2.push(i % 5 == 0 ? t.format('HH:mm') : ' ');
		    	yData.push(Math.random()*20);
		    	yData2.push(Math.random()*20);
		    }*/

			  var series1 = {
			         title: name,
			         x: xData,//['t1', 't2', 't3', 't4'],
			         y: yData,//[5, 1, 7, 5],
			         style:{
				         line:gpuData.color,
				         text:gpuData.color
				       }
			      }
			  
			  tempSeriesData.push(series1);
	    })
	    this.tempChart.setData(tempSeriesData);
	    /*let sum = 0;
	    Object.keys(this.gpus).map(key=>{
	    	let gpu = this.gpus[key];
	    	let last;
	    	if(gpu.data.hashrate.length == 0){
	    		last = 0;
	    		return;
	    	}
	    	sum += gpu.data.hashrate[gpu.data.hashrate.length-1].hashrate;
	    });
	    //console.log('pre update stats',sum);
	    this.updateStats(sum,'hashrate');*/
	    this.screen.render();
	}
	getLinuxRocmNames(){
		this.linuxRocmInfo = {};
		let procStr = '';
		if(this.hasNoRocm) return;
		let proc = spawn('./gpu_stats/linux/rocm-smi',['--showproductname'],{env:process.env})
		proc.stdout.on('data',d=>{
			procStr += d.toString('utf8');
		})
		proc.stderr.on('data',d=>{
			this.hasNoRocm = true;
			console.log('rocm not here??',d.toString('utf8'));
		})
		proc.on('close',()=>{
			let lines = procStr.split('\n');
			lines.map(line=>{
				let toSearchFor = 'card series';
				if(line.toLowerCase().indexOf(toSearchFor) >= 0){
					//we have a card then.
					let gpuID = line.split(']')[0].split('[')[1];
					let gpuName = line.split('series:')[1].trim();
					gpuName = gpuName.indexOf('Ellesmere') >= 0 ? 'RX480/580' : gpuName;
					gpuName = gpuName.indexOf('Vega 20') >= 0 ? 'VII' : gpuName;
					this.linuxRocmInfo[gpuID] = gpuName;

				}
			})
		})
	}
	getPowerMetricsLinux(){
		let strAMD = '';
		let strNVDA = '';
		if(typeof this.gpus == "undefined"){
			return false;
		}
		if(typeof this.linuxRocmInfo == "undefined"){
			//--showproductname
			this.getLinuxRocmNames();
			//return;
		}
		let hasNvidiaCardsPresent = false;
		let hasAMDCardsPresent = false;
		Object.keys(this.gpus).map(gpuKey=>{
			let gpu = this.gpus[gpuKey];
			let mfg = gpu.info.manufacturer.toLowerCase();
			if(mfg.indexOf('nvidia') >= 0 || mfg.indexOf('geforce') >= 0){
				hasNvidiaCardsPresent = true;
			}
			if(mfg.indexOf('advanced micro') >= 0 || mfg.indexOf('amd') >= 0){
				hasAMDCardsPresent = true;
			}
		});
		if(hasAMDCardsPresent){
			let procAMD = spawn('./gpu_stats/linux/rocm-smi',['-a','--json'],{env:process.env});
			procAMD.stdout.on('data',d=>{
				strAMD += d.toString('utf8');
			})
			procAMD.stderr.on('data',d=>{
				//console.log('AMD rocm-smi ERROR',d.toString('utf8'))
			})

			procAMD.on('close',()=>{
				//console.log('amd is done',strAMD.split('\n'));
				//console.log('done with rocm-smi',strAMD);
				strAMD.split('\n').map(line=>{
					let objOut;
					//console.log('line isset?',line);
					try{

						//console.log('wtf line???',line);
						objOut = JSON.parse(line);
					}
					catch(e){
						objOut = undefined;
						
					}
					//console.log('objOut',objOut);
					if(typeof objOut == "object"){
						//success!
						Object.keys(objOut).map(cardID=>{
							let card = objOut[cardID];
							let cardInt = cardID.replace('card','');
							if(typeof this.linuxRocmInfo != "undefined"){
								if(typeof this.linuxRocmInfo[cardInt] != "undefined"){

									//	console.log('has rocm name then',this.linuxRocmInfo[cardInt]);
									let gpuLen = Object.keys(this.gpus).length;
									for(let ii=0;ii<gpuLen;ii++){
										let key = Object.keys(this.gpus)[ii];
										let gpu = this.gpus[key];
										let strName = this.linuxRocmInfo[cardInt];

										let tempGPU = card["Temperature (Sensor #1)"].replace('C','').trim();
										let fanPerc = card["Fan Level"].split('(')[1].replace('%)','').trim();
										let powerW = card["Average Graphics Package Power"].replace('W','').trim();
										let memClock = card["mclk Clock Level"].split('(')[1].replace('MHz)','').trim();
										let gpuClock = card["sclk Clock Level"].split('(')[1].replace('MHz)','').trim();
										let gpuID = card['GPU ID'];
										let gpuLoad = card["Current GPU use"].replace('%','').trim();
										let voltage = card["Voltage"].replace('mV','').trim();

										if(typeof gpu.atiID == "undefined"){
											//ok check name then.
											//console.log('strname check',strName,gpu.info.name);
											if(strName.indexOf(gpu.info.name) >= 0){
												//matchville
												this.gpus[key].atiID = cardID;//gpuID;
												this.gpus[key].data.temperature.push({temperature:parseFloat(tempGPU),time:moment().format('HH:mm')});
												this.gpus[key].data.fan.push({fans:parseFloat(fanPerc),time:moment().format('HH:mm')});
												this.gpus[key].data.gpuCoreClock.push({clock:parseFloat(gpuClock),time:moment().format('HH:mm')});
												this.gpus[key].data.gpuMemoryClock.push({clock:parseFloat(memClock),time:moment().format('HH:mm')});
												this.gpus[key].data.power.push({power:parseFloat(powerW),time:moment().format('HH:mm')});
												this.gpus[key].data.voltage.push({voltage:parseFloat(voltage),time:moment().format('HH:mm')});
												
												//console.log('did set infos for gpu',key);
												break;
											}

										}
										else{
											//ok is it the same then?
											if(gpu.atiID == cardID && strName.indexOf(gpu.info.name) >= 0){
												//ok fair to say this is our match
												this.gpus[key].data.temperature.push({temperature:parseFloat(tempGPU),time:moment().format('HH:mm')});
												this.gpus[key].data.fan.push({fans:parseFloat(fanPerc),time:moment().format('HH:mm')});
												this.gpus[key].data.gpuCoreClock.push({clock:parseFloat(gpuClock),time:moment().format('HH:mm')});
												this.gpus[key].data.gpuMemoryClock.push({clock:parseFloat(memClock),time:moment().format('HH:mm')});
												this.gpus[key].data.power.push({power:parseFloat(powerW),time:moment().format('HH:mm')});
												this.gpus[key].data.voltage.push({voltage:parseFloat(voltage),time:moment().format('HH:mm')});
												
												break;
											}
										}
									}
								}
							}
						})
						//console.log('got rocm json line',objOut);
					}
				})
			});
		}
		if(hasNvidiaCardsPresent){
			let procNVDA = spawn('nvidia-smi',['--query-gpu=temperature.memory,temperature.gpu,fan.speed,power.draw,clocks.current.memory,clocks.current.graphics,clocks.current.sm,gpu_name,pci.device,utilization.gpu', '--format=csv'],{env:process.env});
			procNVDA.stdout.on('data',d=>{
				strNVDA += d.toString('utf8');
			})
			
			procNVDA.stderr.on('data',d=>{
				//console.log('NVDA nvidia-smi ERROR',d.toString('utf8'))
			})
			procNVDA.on('close',()=>{
				//console.log('done with nvidia-smi',strNVDA);
				let lines = strNVDA.split('\n');
				for(let i=1;i<lines.length;i++){
					//console.log('line',i,lines[i]);

					let vals = lines[i].split(',');
					
					if(vals.length <= 1){
						break;
					}
					let tempMem = vals[0];
					let tempGPU = vals[1];
					let fanPerc = vals[2].replace('%','').trim();
					let powerW = vals[3].replace('W','').trim();
					let memClock = vals[4].replace('MHz','').trim();
					let gpuClock = vals[5].replace('MHz','').trim();
					let strName = vals[7];
					let gpuID = parseInt(vals[8],16);
					let gpuLoad = vals[9].replace('%','').trim();
					let len = Object.keys(this.gpus).length;
					//console.log('we have info tho',vals);
					for(let ii=0;ii<len;ii++){
						let key = Object.keys(this.gpus)[ii];
						let gpu	= this.gpus[key];

						if(typeof gpu.atiID == "undefined"){
							//ok check name then.
							//console.log('strname check',strName,gpu.info.name);
							if(strName.indexOf(gpu.info.name) >= 0){
								//matchville
								gpu.atiID = gpuID;
								this.gpus[key].data.temperature.push({temperature:parseFloat(tempGPU),time:moment().format('HH:mm')});
								this.gpus[key].data.fan.push({fans:parseFloat(fanPerc),time:moment().format('HH:mm')});
								this.gpus[key].data.gpuCoreClock.push({clock:parseFloat(gpuClock),time:moment().format('HH:mm')});
								this.gpus[key].data.gpuMemoryClock.push({clock:parseFloat(memClock),time:moment().format('HH:mm')});
								this.gpus[key].data.power.push({power:parseFloat(powerW),time:moment().format('HH:mm')});
								//console.log('did set infos for gpu',key);
								break;
							}

						}
						else{
							//ok is it the same then?
							if(gpu.atiID == gpuID && strName.indexOf(gpu.info.name) >= 0){
								//ok fair to say this is our match
								this.gpus[key].data.temperature.push({temparature:parseFloat(tempGPU),time:moment().format('HH:mm')});
								this.gpus[key].data.fan.push({fans:parseFloat(fanPerc),time:moment().format('HH:mm')});
								this.gpus[key].data.gpuCoreClock.push({clock:parseFloat(gpuClock),time:moment().format('HH:mm')});
								this.gpus[key].data.gpuMemoryClock.push({clock:parseFloat(memClock),time:moment().format('HH:mm')});
								this.gpus[key].data.power.push({power:parseFloat(powerW),time:moment().format('HH:mm')});
								//console.log('did set infos for gpu',key);
								/*
								this.gpus[k].data.temperature.push({temperature:parseFloat(gpu.sensors['temperature'].features[0].v0),time:moment().format('HH:mm')})
								
								this.gpus[k].data.fan.push({fans:parseFloat(gpu.sensors['control'].features[0].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.gpuCoreClock.push({clock:parseFloat(gpu.sensors['clock'].features[0].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.gpuMemoryClock.push({clock:parseFloat(gpu.sensors['clock'].features[1].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.voltage.push({voltage:parseFloat(gpu.sensors['voltage'].features[0].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.load.push({load:parseFloat(gpu.sensors['load'].features[0].v0),time:moment().format('HH:mm')});
								let power = wattsMax * 1.618 * (parseFloat(gpu.sensors['load'].features[0].v0)/100) * parseFloat(gpu.sensors['voltage'].features[0].v0) ^ 2;
								this.gpus[k].data.power.push({power:power,time:moment().format('HH:mm')})
								
								*/
								break;
							}
						}
					}
				}
			});
		}
	}
	getNvidiaGpu(name,id){

	}
	getAmdGpu(name,id){

	}
	getPowerMetricsWin(){
		//console.log('get windows power metrics');
		let str = '';
		let proc = spawn('./OpenHardwareMonitorReport.exe',[],{cwd:__dirname+'/../gpu_stats/windows/',env:process.env});
		proc.stdout.on('data',function(d){
			let outs = d.toString('utf8');
			str += outs;
		})
		let lines = [];
		proc.on('close',(d)=>{
			if(str.length > 0){
				
				str = str.split('Sensors')[1];
				str = str.split('--------------')[0];
				//ok now we got to the sensors, split by blocks
				lines = str.split('\r\n');
				let sectionIDs = [];
				let sectionData = {};
				let sectionGPUs = [];
				let gpus = {};
				let lastSectionID = 0;
				let lastSectionName = 0;
				lines.map((line,i)=>{
					if(line.indexOf('+-') == 0){
						//this is a new section
						sectionIDs.push(i);
						lastSectionID = i;
						sectionData[i] = [];
						lastSectionName = line;
						//sectionData[i].push(line);

					}
					if(line.indexOf('+- GPU ') >= 0){
						//this is def a gpu
						if(sectionGPUs.indexOf(lastSectionID) == -1){
							//only need to mark once here
							sectionGPUs.push(lastSectionID);
						}
						let split0 = line.split(':');
						let featureName = 'GPU '+split0[0].split('GPU')[1].trim();

						let half2 = split0[1].split('(');
						let v0 = half2[0].substring(0,9).trim();
						let v1 = half2[0].substring(10,18).trim();
						let v2 = half2[0].substring(19).trim();
						let sensorName = half2[1].split('/')[3];
						
						let GPUName = lastSectionName.replace('+- ','').split('(')[0].trim();
						let gpuID = lastSectionName.split('(')[1].replace(')','');
						
						if(typeof gpus[GPUName+'_'+gpuID] == "undefined"){
							let gpu = {
								id: gpuID,
								name: GPUName,
								sensors:{}
							}		
							gpus[GPUName+'_'+gpuID] = gpu;
						}
						if(typeof gpus[GPUName+'_'+gpuID].sensors[sensorName] == "undefined"){
							gpus[GPUName+'_'+gpuID].sensors[sensorName] = {name:sensorName,features:[]};
						}
						gpus[GPUName+'_'+gpuID].sensors[sensorName].features.push({name:featureName,v0:v0,v1:v1,v2:v2})
					}
					if(typeof sectionData[lastSectionID] != "undefined"){
						sectionData[lastSectionID].push(line);
					}
				})
				//console.log('are gpu undefined?',typeof this.gpus);
				if(typeof this.gpus == "undefined"){
					return;	
				}

				Object.keys(gpus).map(k=>{return gpus[k];}).map(gpu=>{
					let gpuName = gpu.name;
					if(typeof gpu.sensors['control'] == "undefined"){
						//this one doesnt report fan speed
						gpu.sensors['control'] = {features:[{v0:-1}]};
					}
					if(typeof gpu.sensors['voltage'] == "undefined"){
						gpu.sensors['voltage'] = {features:[{v0:-1}]}
					}
					//try to find a non-claimed match..
					let keys = Object.keys(this.gpus)
					for(let keyI=0;keyI<keys.length;keyI++){
						//doing a for loop so we can break; it
						let k = keys[keyI];
						let gpuItem = this.gpus[k];
						let wattsMax = 120;
						let clockMax = 1100;
						if(typeof this.gpuPowerTable[gpuItem.info.name] != "undefined"){
							wattsMax = this.gpuPowerTable[gpuItem.info.name].watts;
						}

						//console.log('gpuitem id',gpuItem.atiID,gpuName,gpuItem.info.name);
						//console.log('gpu data then',gpuItem,gpu.sensors['temperature'],gpu.id);
						if(typeof gpuItem.atiID == "undefined"){

							if(gpuName.indexOf(gpuItem.info.name) >= 0){
								//console.log('gpu match with no atiID',gpu.id,gpu.sensors['temperature'].features);
								this.gpus[k].atiID = gpu.id;
								this.gpus[k].data.temperature.push({temperature:parseFloat(gpu.sensors['temperature'].features[0].v0),time:moment().format('HH:mm')})
							
								this.gpus[k].data.fan.push({fans:parseFloat(gpu.sensors['control'].features[0].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.gpuCoreClock.push({clock:parseFloat(gpu.sensors['clock'].features[0].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.gpuMemoryClock.push({clock:parseFloat(gpu.sensors['clock'].features[1].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.voltage.push({voltage:parseFloat(gpu.sensors['voltage'].features[0].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.load.push({load:parseFloat(gpu.sensors['load'].features[0].v0),time:moment().format('HH:mm')});
								let power;
								if(gpu.sensors['voltage'].features[0].v0 == -1){
									power = wattsMax * ((parseFloat(gpu.sensors['load'].features[0].v0)/100));
								}
								else{
									power = wattsMax * 1.618 * (parseFloat(gpu.sensors['load'].features[0].v0)/100) * parseFloat(gpu.sensors['voltage'].features[0].v0) ^ 2;
								}
								this.gpus[k].data.power.push({power:power,time:moment().format('HH:mm')})
								
								break;
							}
						}
						else{

							if(gpuItem.atiID == gpu.id){
								//console.log('should push sensor data',gpu.id,gpu.sensors['temperature'].features[0].v0)
								//its a gpu match, append datas
								this.gpus[k].data.temperature.push({temperature:parseFloat(gpu.sensors['temperature'].features[0].v0),time:moment().format('HH:mm')})
								
								this.gpus[k].data.fan.push({fans:parseFloat(gpu.sensors['control'].features[0].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.gpuCoreClock.push({clock:parseFloat(gpu.sensors['clock'].features[0].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.gpuMemoryClock.push({clock:parseFloat(gpu.sensors['clock'].features[1].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.voltage.push({voltage:parseFloat(gpu.sensors['voltage'].features[0].v0),time:moment().format('HH:mm')});
								this.gpus[k].data.load.push({load:parseFloat(gpu.sensors['load'].features[0].v0),time:moment().format('HH:mm')});
								let power;
								if(gpu.sensors['voltage'].features[0].v0 == -1){
									power = wattsMax * ((parseFloat(gpu.sensors['load'].features[0].v0)/100));
								}
								else{
									power = wattsMax * 1.618 * (parseFloat(gpu.sensors['load'].features[0].v0)/100) * parseFloat(gpu.sensors['voltage'].features[0].v0) ^ 2;
								}

								this.gpus[k].data.power.push({power:power,time:moment().format('HH:mm')})

								break;
							}
							
						}
					} 

				})
				//process.stdout.write(JSON.stringify(gpus)+'\n');
				//process.exit(0);
				/*Object.keys(gpus).map(gpuID=>{
					let gpu = gpus[gpuID];
					//console.log('############################');
					console.log(JSON.stringify(gpu,null,2));
					//console.log('############################');
				})*/
				//console.log('report data out',str,str.length);
			}	
		})



		/*let stats = spawn('node',['./get_gpu_stats.js'],{cwd:__dirname+'/../gpu_stats/windows/',env:process.env});
		stats.stderr.on('data',data=>{
			console.log('power metrics windows error',data.toString('utf8'));
		})
		let allData = '';
		stats.stdout.on('data',data=>{
			allData += data.toString('utf8');
		})*/
		/*stats.on('close',data=>{
			let d;
			try{
				d = JSON.parse(allData);
			}
			catch(e){
				console.error('error with stats',e.toString('utf8'),allData);
				return;
			}
			console.log('stats data',d.length);
			
			d.map(gpu=>{
				let gpuName = gpu.name;
				//try to find a non-claimed match..
				Object.keys(this.gpus).map(k=>{
					let gpuItem = this.gpus[k];
					if(typeof gpuItem.atiID == "undefined"){
						if(gpuName.indexOf(gpuItem.name) >= 0){
							this.gpus[k].atiID = gpuName.id;
							this.gpus[k].data.temperature.push({temperature:parseFloat(gpu.sensors['temperature'].features.v0),time:moment().format('MMM-DD HH:mm')})
						}
					}
					else{
						this.gpus[k].data.temperature.push({temperature:parseFloat(gpu.sensors['temperature'].features.v0),time:moment().format('MMM-DD HH:mm')})
							
					}
				}) 
			})
		})*/

	}
	getPowerMetricsMac(){
		//sudo powermetrics -i 200 -n1 --samplers smc
		//if(process.platform.indexOf('darwin') >= 0){
			let smc = spawn('powermetrics',['-i','200','-n','1','--samplers','all','--show-process-gpu'],{env:process.env});
			smc.stderr.on('data',data=>{
				//console.log('power data err',data.toString('utf8'));
			})
			let smcData = '';
			smc.stdout.on('data',data=>{
				//console.log('power data out',data.toString('utf8'));
				smcData += data.toString('utf8');
				
			})
			smc.on('close',()=>{

				let parts = smcData.split('**** SMC sensors ****')[1];
				let isSMCDone = false
				parts.split('\n').map(line=>{
					if(line.indexOf('****') >= 0 || isSMCDone){
						//section is done
						isSMCDone = true;
						return false;
					}
					if(line.indexOf('GPU') == 0){
						if(line.indexOf('temperature') >= 0){
							//is temp
							if(typeof this.gpus != "undefined"){
								Object.keys(this.gpus).map(key=>{
									let gpuD = this.gpus[key];
									let tempD = {temperature:parseFloat(line.split(':')[1].replace('C','').trim()),time:moment().format('HH:mm')};

									/*console.log('');
									console.log('tempD',tempD)*/
									this.gpus[key].data.temperature.push(tempD);
								})
							}
						}
						
					}
					if(line.indexOf('Fan') >= 0){
						//its the fan speed
						let fanSpeed = line.split(':')[1].replace('rpm','').trim();
						if(typeof this.gpus != "undefined"){
							Object.keys(this.gpus).map(key=>{
								let gpuD = this.gpus[key];
								let fanD = {fans:Math.floor(parseFloat(fanSpeed)/6200*100),time:moment().format('HH:mm')};
								//console.log('fan data isset',fanD);
								/*console.log('');
								console.log('tempD',tempD)*/
								this.gpus[key].data.fan.push(fanD);
							})
						}
					}
				});
				let powerParts = smcData.split('**** Processor usage ****')[1].split('\n');
				let hasFoundPowerPart = 0;
				let powerW = 0;
				let p2Len = powerParts.length;
				for(let i=0;i<p2Len;i++){
					let line = powerParts[i];
					if(line.indexOf('Intel energy model derived') >= 0){
						//its the power line
						hasFoundPowerPart = true;
						powerW = 80+parseFloat(line.split(':')[1].replace('W','').trim()); //macbook pro is 86w, they dont give any stats anymore easily so here we go. 
						break;
					}
					if(line.indexOf('****') >= 0){
						//section is done then
						break;
					}
				}
				if(typeof this.gpus != "undefined"){
					Object.keys(this.gpus).map(key=>{
						let gpuD = this.gpus[key];
						let powerD = {power:parseFloat(powerW),time:moment().format('HH:mm')};

						/*console.log('');
						console.log('tempD',tempD)*/
						this.gpus[key].data.power.push(powerD);
					})
				}

			})
		//}
	}
	startMiner(){
		console.log('STARTING MINER DASHBOARD...');
		let hasAddedGPUs = false;
		let registeredGPUs = [];

		//const miner = new HandyMiner();		
		process.env.HANDYRAW=true;
		let minerProcess = spawn('node',[__dirname+'/../mine.js'],{env:process.env});
		//console.log('miner process????',minerProcess);
		minerProcess.stderr.on('data',d=>{
			console.log('sterr',d.toString('utf8'))
		})
		minerProcess.stdout.on('data',d=>{
			
			let dN = d.toString('utf8').split('\n');
			//console.log('miner stdout isset',dN);
			let didConfirm = false;
			dN.map((line)=>{
				try{
					let json = JSON.parse(line.toString('utf8'));
					//console.log('data back',json);
					if(json.type == 'registration'){
						//console.log('will show devices now',json);
						//showDevices(json.data);
						if(!hasAddedGPUs){
							registeredGPUs = registeredGPUs.concat(json.data);
							//this.addGPUs(json.data);
							if(registeredGPUs.length == this.config.gpus.split(',').length){
								hasAddedGPUs = true;
								let s = '';
								let r = process.stdout.rows;
								//console.log('rows wtf?',r);
								for(let i=0;i<r;i++){
									s += '\n';//clear out the screen then
								}
								console.log(s);
								//console.log('we added screen here irl')
								this.addGPUs(registeredGPUs);
							}
							//hasAddedGPUs = true;
						}
						//console.log('adding gpu',registeredGPUs);
						this.pushToLogs(json.data,'stdout');
					}
					else{
						
						if(json.type == 'confirmation' && typeof json.granule != "undefined" && !didConfirm){
							//didConfirm just in case there is some duplicate message in the same batch of lines. If you're crushing blocks like that why does it matter we show blinky this many times anyway..
							didConfirm = true;
							this.statsData.shares++;
							this.updateStats(moment(),'last');
							this.initFanfare(json);
						}
						if(!hasAddedGPUs && json.type != "difficulty"){
							console.log(json);
						}
						//console.log(json);
						if(json.action == 'stratumLog' || json.action == 'log' || json.type == 'log'){
							//its a status updat
							this.pushToLogs(json.data||[json],'stdout');
						}
						else{
							this.pushToLogs(json.data || [json],'stdout');
						}
						
					}
					if(json.type == 'error'){
						this.pushToLogs(json.data,'error');
					}
				}
				catch(e){
					//console.log('error',e);
				}
			})
		});
		this.minerProcess = minerProcess;

	}
	initFanfare(json){
		let logInitLines = [
			'################',
			'       ___      ',
			'     /__/\\    ',
			'     \\  \\:\\   ',
			'      \\__\\:\\  ',
			'  ___ /  /::\\ ',
			' /__/\\  /:/\\:\\',
			' \\  \\:\\/:/__\\/',
			'  \\  \\::/     ',
			'   \\  \\:\\     ',
			'    \\  \\:\\    ',
			'     \\__\\/    ',
			'                ',
			'################',
			'ACCEPTED '+json.granule+'!',
			'# '+moment().format('MMM-DD HH:mm:ss')+' #',
			'################'
		];
		let width;
		if(process.platform.indexOf('darwin') >= 0){
			width = process.stdout.columns * 0.75;
		}
		else{
			width = (process.stdout.columns/this.gridWidth)*3;// / (this.gridWidth*1.5);
		}
		logInitLines = logInitLines.map(line=>{
			let lineW = line.length;
			let diff = Math.floor((width-lineW)/2);
			let pad = '';
			let pad2 = '\x1b[32;5;7m';
			let pad3 = '';
			for(let i=0;i<diff;i++){
				if(line.indexOf('#') >= 0){
					pad += '#'
				}
				else{
					pad += ' ';
					pad2 += ' ';
					pad3 += ' ';
				}
				
			}
			pad3 += '\x1b[0m';
			
			if(line.indexOf('#') >= 0){
				this.logsBox.log(pad+line+pad);
			}
			else{
				this.logsBox.log(pad2+line+pad3);
			}
			if(this.logsBox.logLines.length > 2000){
				this.logsBox.logLines = this.logsBox.logLines.slice(this.logsBox.logLines.length-500,this.logsBox.logLines.length);
			}
		});
	}
	pushToLogs(jsonLines,type){
		jsonLines.map(json=>{

			switch(json.type){
				case 'status':
					//hashrte update
					let hr = json.hashRate;
					let hr120 = json.avg120sHashRate;
					let gpuID = json.gpuID;
					let platform = json.platformID;
					if(hr > 0 && hr < hr120*4){
						//only report real hashrates
						this.gpus[platform+'_'+gpuID].data.hashrate.push({hashrate:hr,time:moment().format('HH:mm')});
						this.gpus[platform+'_'+gpuID].data.hashrate120.push({hashrate:hr120,time:moment().format('HH:mm')});
						this.actuallyLog('GPU '+platform+'.'+gpuID+' '+this.gpus[platform+'_'+gpuID].info.name+': \x1b[36m0x'+(json.nonce.substring(8))+' '+(numeral(hr).format('0.0b').replace('B','H'))+' AVG: '+(numeral(hr120).format('0.0b').replace('B','H'))+'\x1b[0m');
						this.drawHashrate();
					}
				break;
				case 'difficulty':
					this.statsData.difficulty = json.difficulty;
					this.statsData.target = json.target;
					this.updateStats(this.statsData.target,'target');
				break;
				default:
					//console.log('\n some data is here???',json);
					//this.actuallyLog(JSON.stringify(json));
				break;
				/*DEPRECATING
				case 'confirmation':
					this.statsData.shares++;
					this.updateStats(moment(),'last');
					this.initFanfare(json);
				break;*/
				case 'log':
				case 'stratumLog':
					this.actuallyLog(json);
				break;
			}
			if(json.action == 'log' && json.gpuid_set_work){
				//this is a new work notification
				//why, this message really isnt helpful tbh
				//this.actuallyLog('NEW BLOCK HEADER FOR GPU '+json.gpuid_set_work);
			}
			else if(json.action == 'log' && json.status){
				this.actuallyLog('GPU '+json.gpuID+' STATUS: '+json.status);
			}
			
		});
	}
	actuallyLog(str){
		this.logsBox.log(str);
		this.screen.render();
	}
	drawHashrate(){
		let xNow = moment();
	    let hashrateSeriesData = [];
	    let tempSeriesData = [];
	    
	    Object.keys(this.gpus).map(gpuKey=>{
	    	let gpuData = this.gpus[gpuKey];
	    	let name = gpuData.info.name;
	    	let hashData = gpuData.data.hashrate;
	    	let hd120 = gpuData.data.hashrate120;
	    	let xData = [];
		    let yData = [];
		    let xData2 = [];
		    let yData2 = [];
		    if(hashData.length > this.linechartTicksMax){
		    	hashData = hashData.slice(hashData.length-(this.linechartTicksMax/2),hashData.length);
		    }
		   	if(hd120.length > this.linechartTicksMax){
		    	hd120 = hd120.slice(hd120.length-(this.linechartTicksMax/2),hd120.length);
		    	this.gpus[gpuKey].data.hashrate120 = hd120;
		    }
		    hashData.map((d,i)=>{

		    	yData.push(parseInt(d.hashrate/1000000));
		    	let modRate = 100;
		    	if(hashData.length < this.linechartTicksMax){
		    		modRate = 10;
		    	}
		    	if(hashData.length < this.linechartTicksMax/2){
		    		modRate = 5;
		    	}
		    	if(hashData.length < this.linechartTicksMax/4){
		    		modRate = 2;
		    	}
		    	xData.push(i % modRate == 0 ? d.time : ' ');
		    })
		    
			var series1 = {
			     title: name,
			     x: xData,//['t1', 't2', 't3', 't4'],
			     y: yData,//[5, 1, 7, 5],
			     style:{
			         line:gpuData.color,
			         text:gpuData.color
			       }
			}

			hashrateSeriesData.push(series1);
	    })
	    this.hashChart.setData(hashrateSeriesData);
	    let sum = 0;
	    let sum120 = 0;
	    Object.keys(this.gpus).map(key=>{
	    	let gpu = this.gpus[key];
	    	let last;
	    	if(gpu.data.hashrate.length == 0){
	    		last = 0;
	    		return;
	    	}
	    	sum120 += gpu.data.hashrate120[gpu.data.hashrate120.length-1].hashrate;
	    	sum += gpu.data.hashrate[gpu.data.hashrate.length-1].hashrate;
	    });
	    
	    this.updateStats(sum,'hashrate');
	    this.updateStats(sum120,'hashrate120');
	    this.screen.render();
	}
	updateStats(data,type){
		this.statsData[type] = data;
		
		let statsData = [
	  	'Shares: \x1b[36m'+numeral(this.statsData['shares']).format('0a')+'\x1b[0m',
	  	'Errors: \x1b[36m'+numeral(this.statsData['errors']).format('0a')+'\x1b[0m',
	  	'Last Share: \x1b[36m'+(typeof this.statsData['last'] == "undefined" ? 'none' : this.statsData['last'].format('MMM-DD HH:mm'))+'\x1b[0m',
	  	'Started: \x1b[36m'+this.statsData['started'].format('MMM-DD HH:mm')+'\x1b[0m',
	  	'Rig Hashrate: \x1b[36m'+(numeral(this.statsData['hashrate']).format('0.0b').replace('B','H'))+'\x1b[0m',
	  	'Avg Hashrate: \x1b[36m'+(numeral(this.statsData['hashrate120']).format('0.0b').replace('B','H'))+'\x1b[0m',
	  	'Block Target: \x1b[36m0x'+(this.statsData.target.slice(0,32))+'\x1b[0m',
	  	'Difficulty: \x1b[36m'+(this.statsData.difficulty)+'\x1b[0m'
	  ];
	  
	  this.statsBox.logLines = [];
	  statsData.map(d=>{
	  	this.statsBox.log(d);
	  })
	  

	  this.screen.render();
	}
	addGPUs(gpuList){

		let gpuSet = {};
		let gpuItems = gpuList.map((gpu,gpuI)=>{
			let color = this.colors[ gpuI % this.colors.length ];
			if(typeof color == "undefined"){
				console.log('color is undefined',this.colors.length,gpuI,this.colors.length%gpuI)
				//color = this.colors[0];
			}
			
			//apparently can round a hex to an 8bit
			let colorBytes = {
				r:parseInt('0x'+color.substring(1,3),16),
				g:parseInt('0x'+color.substring(3,5),16),
				b:parseInt('0x'+color.substring(5,7),16)
			};
			//console.log('colors',color);

			/*let red = (colorBytes.r * 8) / 256;
			let green = (colorBytes.g * 8) / 256;
			let blue = (colorBytes.b * 4) / 256;*/
			let color_8bit = [Math.floor(colorBytes.r),Math.floor(colorBytes.g),Math.floor(colorBytes.b)]//(red << 5) | (green << 2) | blue;
			//let color_8bit = color;
			//console.log('color isset',color,color_8bit);
			let gpuID = gpu.platform+'_'+gpu.id;
			gpuSet[gpuID] = {
				info:gpu,
				data:{
					temperature:[],
					power:[],
					fan:[],
					gpuCoreClock:[],
					gpuMemoryClock:[],
					voltage:[],
					load:[],
					memory:[],
					hashrate:[],
					hashrate120:[],
					difficulty:[]
				},
				color:color_8bit,
				temperature:0,
				power:0,
				fan:0,
				memory:0,
				hashrate:0,
				difficulty:0
			}
		});
		//console.log('setup gpus',gpuSet);
		this.gpus = gpuSet;
		/*let hashChart = contrib.line(
         { style:
           { line: "yellow"
           , text: "green"
           , baseline: "black"}
         , xLabelPadding: 3
         , xPadding: 5
         , showLegend: true
         , wholeNumbersOnly: false //true=do not show fraction in y axis
         , label: 'Title'})*/
    let xNow = moment();
    let hashrateSeriesData = [];
    let tempSeriesData = [];
    Object.keys(gpuSet).map(gpuKey=>{
    	let gpuData = gpuSet[gpuKey];
    	let name = gpuData.info.name;
    	if(name == 'gfx900'){
    		name = 'RX Vega';
    	}
    	if(name == 'gfx906'){
    		name = 'VII';
    	}
    	if(name == 'gfx1010'){
    		name = '5700XT';
    	}
    	if(name == 'gfx1000'){
    		name = '5700';
    	}
    	if(name == 'Ellesmere'){
    		name = 'RX480/580'
    	}
    	if(name.indexOf('AMD Radeon Pro') >= 0 && name.indexOf('Compute Engine') >= 0){
    		//this is the mac amd radeon products, lets shorten the name.
    		let shortened = name.replace('AMD Radeon Pro','Radeon').replace('Compute Engine','');
    		name = shortened;
    	}
    	if(name.toLowerCase().indexOf('geforce') >= 0 || name.toLowerCase().indexOf('nvidia') >= 0){
    		if(name.indexOf('960') >= 0){
    			name = '960';
    		}
    		if(name.indexOf('1060') >= 0){
    			name = '1060';
    		}
    		if(name.indexOf('1070') >= 0){
    			name = '1070';
    		}
    		if(name.indexOf('1080') >= 0){
    			name = '1080';
    		}
    		if(name.indexOf('1660') >= 0){
    			name = '1660';
    		}
    		if(name.indexOf('2060') >= 0){
    			name = '2060';
    		}
    		if(name.indexOf('2080') >= 0){
    			name = '2080';
    		}
    		if(name.indexOf('2070') >= 0){
    			name = '2070';
    		}
    	}
    	gpuSet[gpuKey].info.name = name;
    	
    	let xData = [];
	    let yData = [];
	    let xData2 = [];
	    let yData2 = [];
	    for(let i=0;i<20;i++){
	    	let t = xNow.clone().subtract(20-i,'minutes');
	    	xData.push(i % 5 == 0 ? t.format('HH:mm') : ' ');
	    	xData2.push(i % 5 == 0 ? t.format('HH:mm') : ' ');
	    	yData.push(0/*Math.random()*20*/);
	    	yData2.push(0/*Math.random()*20*/);
	    }
		  var series1 = {
		         title: name,
		         x: xData,//['t1', 't2', 't3', 't4'],
		         y: yData,//[5, 1, 7, 5],
		         style:{
			         line:gpuData.color,
			         text:gpuData.color
			       }
		      }
		  var series2 = {
		         title: name,
		         x: xData2,//['t1', 't2', 't3', 't4'],
		         y: yData2,//[2, 1, 4, 8],
		         style:{
			         line:gpuData.color,
			         text:gpuData.color
			       }
		      }
		  hashrateSeriesData.push(series1);
		  tempSeriesData.push(series2);
    })
    
	  let hashChart = this.grid.set(0,0,2,4,contrib.line,{
	  		label:'Hashrate (MH)',
          xLabelPadding: 3,
          xPadding: 5,
          showLegend: true,
          wholeNumbersOnly: false}); //must append before setting data

	  let tempChart = this.grid.set(0,4,2,4,contrib.line,{
	  		label:'GPU Temperature (C)',
          xLabelPadding: 3,
          xPadding: 5,
          showLegend: true,
          wholeNumbersOnly: false}); //must append before setting data
	  let energyPosX = process.platform.indexOf('darwin') >= 0 ? 0 : 3;
	  let energyArea = this.grid.set(2,energyPosX,1,2,contrib.sparkline,{
	  	label:'Power Usage',
	  	tags: true,
	  	labelPadding: 3,
      style: { fg: 'blue' }
	  })
	  let memPosX = process.platform.indexOf('darwin') >= 0 ? 9 : 0;
	  let memSpeedArea = this.grid.set(2,memPosX,2,1,contrib.sparkline,{
	  	label:'GPU Memory',
	  	tags:true,
	  	labelPadding:3,
	  	style: {fg: 'blue'}
	  });
	  let gpuSpeedPosX = process.platform.indexOf('darwin') >= 0 ? 9 : 1;
	  let gpuSpeedArea = this.grid.set(2,gpuSpeedPosX,2,1,contrib.sparkline,{
	  	label:'GPU Core',
	  	tags:true,
	  	labelPadding:3,
	  	style: {fg: 'blue'}
	  });
	  let voltageSpeedArea;
	  if(process.platform.indexOf('linux') >= 0){
	  	voltageSpeedArea = this.grid.set(2,2,2,1,contrib.sparkline,{
			label:'GPU Wattage',
			tags:true,
			labelPadding:3,
			style: {fg: 'blue'}
		});
	  }
	  else{
	  	let voltagePosX = process.platform.indexOf('darwin') >= 0 ? 9 : 2;
	  	voltageSpeedArea = this.grid.set(2,voltagePosX,2,1,contrib.sparkline,{
			label:'GPU Voltage',
			tags:true,
			labelPadding:3,
			style: {fg: 'blue'}
		});
	  }
	  
	  //let mdWidget = contrib.markdown();
	  let statsPosX = process.platform.indexOf('darwin') >= 0 ? 0 : 3;
	  let statsBox = this.grid.set(3,statsPosX,1,2,contrib.log,{
	  	label:'Stats',
	  	yLabelPadding:2,
	  	yPadding:2
	  })
	  let logsPosX = process.platform.indexOf('darwin') >= 0 ? 2 : 5;
	  let logsWidth = process.platform.indexOf('darwin') >= 0 ? 6 : 3;
	  let logsBox = this.grid.set(2,logsPosX,2,logsWidth,contrib.log,{
	  	label:'Logs'
	  })

	  let memSpeedLabels = [];
	  let memSpeedDatas = [];
	  Object.keys(this.gpus).map(k=>{
	  	let gpu = this.gpus[k];
	  	let name = gpu.info.name;
	  	let data = [];
	  	let last;
	  	for(let i=0;i<100;i++){
	  		let val = 0;//Math.floor( Math.random() * 2000 );
	  		data.push( val );
	  		last = val;
	  	}
	  	memSpeedLabels.push(name+' \x1b[36m'+last+'MHz\x1b[0m');
	  	memSpeedDatas.push(data)
	  });
	  memSpeedArea.setData(memSpeedLabels,memSpeedDatas);

	  let gpuSpeedLabels = [];
	  let gpuSpeedDatas = [];
	  Object.keys(this.gpus).map(k=>{
	  	let gpu = this.gpus[k];
	  	let name = gpu.info.name;
	  	let data = [];
	  	let last;
	  	for(let i=0;i<100;i++){
	  		let val = 0;//Math.floor( Math.random() * 2000 );
	  		data.push( val );
	  		last = val;
	  	}
	  	gpuSpeedLabels.push(name+' \x1b[36m'+last+'MHz\x1b[0m');
	  	gpuSpeedDatas.push(data)
	  });
	  gpuSpeedArea.setData(gpuSpeedLabels,gpuSpeedDatas);

	  let voltageSpeedLabels = [];
	  let voltageSpeedDatas = [];
	  Object.keys(this.gpus).map(k=>{
	  	let gpu = this.gpus[k];
	  	let name = gpu.info.name;
	  	let data = [];
	  	let last;
	  	for(let i=0;i<100;i++){
	  		let val = 0;//Math.floor( Math.random() * 1100 );
	  		data.push( val );
	  		last = val;
	  	}
	  	voltageSpeedLabels.push(name+' \x1b[36m'+last+'mV\x1b[0m');
	  	voltageSpeedDatas.push(data)
	  });
	  voltageSpeedArea.setData(voltageSpeedLabels,voltageSpeedDatas);

	  this.logsBox = logsBox;
	  this.hashChart = hashChart;
	  this.tempChart = tempChart;
	  this.energyArea = energyArea;
	  this.memSpeedArea = memSpeedArea;
	  this.gpuSpeedArea = gpuSpeedArea;
	  this.voltageSpeedArea = voltageSpeedArea;
	  this.statsBox = statsBox;
	  /*let fanDonut = this.grid.set(2,6,2,2,contrib.donut,{
	  	label:'Fans (%)',
	  	radius:15, 
	  	arcWidth:5
	  })*/
	  /*this.globalHashChart = hashChart;
	  this.globalTempChart = tempChart;*/
	  hashChart.setData(hashrateSeriesData);
	  tempChart.setData(tempSeriesData);
	  /*energyDonut.setData([{percent: 1600, label: 'Energy', color: 'green', suffix:'W'}])
	  fanDonut.setData([{percent: 50, label: 'Fan', color: 'yellow',suffix:'%'}]);*/
	 	let eV = [];
	 	let fV = [];
	 	for(let i=0;i<100;i++){
	 		eV.push(0/*Math.random()*1600*/);
	 		fV.push(0/*Math.random()*100*/);
	 	}
	  energyArea.setData(['Energy \x1b[36m---W\x1b[0m','Fan Speed \x1b[36m--%\x1b[0m'],[eV,fV]);
	  let statsData = [
	  	'Shares: \x1b[36m0\x1b[0m',
	  	'Errors: \x1b[36m0\x1b[0m',
	  	'Last Share: \x1b[36mnone\x1b[0m',
	  	'Started: \x1b[36m'+moment().format('MMM-DD HH:mm')+'\x1b[0m',
	  	'Rig Hashrate:\x1b[36m---MH\x1b[0m',
	  	'Block Target: \x1b[36m---\x1b[0m',
	  	'Difficulty: \x1b[36m---\x1b[0m'
	  ];//'Shares: **20**\nErrors: **1**\nLast Share: **'+moment().format('MMM-DD HH:mm')+'**\nStarted: **'+moment().subtract(1,'day').format('MMM-DD HH:mm')+'**\nCurrent Block: **1500**\nDifficulty: **1.2e5**';
	  statsData.map(d=>{
	  	statsBox.log(d);
	  })
	  statsBox.logLines = statsData;//('foobar');
	  //statsBox.setData(statsData)
	  /*logsBox.log('\x1b[36mLogging\x1b[0m some data...')
	  logsBox.log('Logging some data 2...')*/
	  

		let logInitLines = [
		'################',
		'      ___     ',
		'     /__/\\    ',
		'     \\  \\:\\   ',
		'      \\__\\:\\  ',
		'  ___ /  /::\\ ',
		' /__/\\  /:/\\:\\',
		' \\  \\:\\/:/__\\/',
		'  \\  \\::/     ',
		'   \\  \\:\\     ',
		'    \\  \\:\\    ',
		'     \\__\\/    ',
		'                ',
		'################',
		'#   STARTING   #',
		'#  HANDYMINER  #',
		'################',
		'                '
		];
		let width;
		if(process.platform.indexOf('darwin') >= 0){
			width = process.stdout.columns * 0.75/2;
		}
		else{
			width = process.stdout.columns / (this.gridWidth/1.5);
		}
		

		logInitLines = logInitLines.map(line=>{
			let lineW = line.length;
			let diff = Math.floor(width-lineW/2);
			let pad = '';
			for(let i=0;i<diff;i++){
				if(line.indexOf('#') >= 0){
					pad += '#'
				}
				else{
					pad += ' ';
				}
				
			}
			//console.log('padlen',pad.length,line.length);

			return pad+line+pad;
		});
		logsBox.logLines = logInitLines;

	  //this.screen.render();
	}
	rainbow(){
		let width = process.stdout.columns;
		let padding = '';
		for(let i=0;i<width;i++){
			padding += '#';
		}
		let lines = [
			'',
			'There is a pot of gold at the end of every rainbow,',
			'it is the community that is worth the diamonds.',
			''
		];

		console.log('');
		console.log(padding);
		console.log(padding);
		console.log('');
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
		console.log(padding);
		console.log(padding);
		lines.map(l=>{
			let diff = Math.floor(width-l.length)/2;
			let p0 = '', p1 = '';
			for(let i=0;i<diff;i++){
				p0 += ' ';
				p1 += ' ';
			}
			console.log(p0+l+p1);
		});
		console.log(padding);
		console.log(padding);
		console.log('');
	}

}

let dash = new CLIDashboard();
/*let gpus = [
	{"event":"registerDevice","id":"0","manufacturer":"Intel Inc.","name":"Intel(R) HD Graphics 630","platform":"0"},
	{"event":"registerDevice","id":"1","manufacturer":"AMD","name":"AMD Radeon Pro 560 Compute Engine","platform":"0"}
];

dash.addGPUs(gpus);*/
	
//module.exports = CLIDashboard;


