/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-sync */

import fs from 'fs';

import yaml from 'js-yaml';

import baseLog from './log';
import { ConfigurationError } from './util';

const log = baseLog.extend('file');

export interface FileParser {
	(text: string): any;
}

export const yamlParser: FileParser = (text: string): any => yaml.load(text);
export const jsonParser: FileParser = (text: string): any => JSON.parse(text);

export function readConfigSync(filePath: string, parser: FileParser): any {
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
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		throw new ConfigurationError(
			`Invalid configuration from ${filePath}. Configuration should be an object.`
		);
	}
	return data;
}
