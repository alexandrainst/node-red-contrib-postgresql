'use strict';

module.exports = {
	flowFile: 'project/flows.json',
	flowFilePretty: true,
	telemetryEnabled: false,
	uiPort: process.env.PORT || 1880,
	userDir: '/data',
	editorTheme: {
		tours: false,
		projects: {
			enabled: false,
		},
	},
};
