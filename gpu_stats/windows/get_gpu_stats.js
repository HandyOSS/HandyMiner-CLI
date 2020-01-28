const fs = require('fs');
const spawn = require('child_process').spawn;
let str = '';
let proc = spawn('./OpenHardwareMonitorReport.exe',[]);
proc.stdout.on('data',function(d){
	let outs = d.toString('utf8');
	str += outs;
	/*console.log('strlen',str.length);
	if(str.length > 0){
		
		str = str.split('Sensors')[1];
		//str = str.split('--------------')[0];

		console.log('report data out',str,str.length);
	}*/
})
proc.on('close',function(d){
	//console.log('proc is done');
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
				console.log('last section name is',lastSectionName);
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
		process.stdout.write(JSON.stringify(gpus)+'\n');
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
