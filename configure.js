const HandyMiner = require('./miner/HandyMiner.js');
const Configurator = require('./miner/configurator.js');

const configurator = new Configurator();
configurator.configure(()=>{
	delete process.env.HANDYRAW;
	const miner = new HandyMiner();
});
