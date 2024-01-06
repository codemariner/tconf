const tconfConfig = {
	// relative to this config file
	// default './config'
	path: [
		'./config'
	],
	// default CONFIG
	evnPrefix: 'CONFIG',
	sources: [
		'default', '${NODE_ENV}', 'ENV', 'local'
	]
};

module.exports = tconfConfig;
