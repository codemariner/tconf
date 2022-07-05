/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-sync */

import fs from 'fs';

import baseLog from './log';
import { ConfigParser } from './parsers';
import { ConfigurationError } from './util';

const log = baseLog.extend('file');

export function readConfigSync(filePath: string, parser: ConfigParser): any {
	if (!fs.existsSync(filePath)) {
		log(`config file ${filePath} not found`);
		return {};
	}
	log('parsing config', filePath);
	let data;
	try {
		const contents = fs.readFileSync(filePath, { encoding: 'utf-8' });
		data = parser(contents);
	} catch (e) {
		log(`error parsing configuration file ${filePath}`, e);
		throw new ConfigurationError(
			`Error while parsing configuration file ${filePath}: ${(e as any).message}`
		);
	}
	data ||= {};
	if (typeof data !== 'object' || Array.isArray(data)) {
		throw new ConfigurationError(
			`Invalid configuration from ${filePath}. Configuration should be an object.`
		);
	}
	return data;
}
